/**
 * Reads text out of user documents entirely in the browser. This module is
 * only imported by the Scan screen, so pdf.js, mammoth and tesseract load on
 * demand and never touch the main bundle.
 */

export type ExtractStage = "reading" | "ocr" | "loading-ocr";

export interface ExtractProgress {
  stage: ExtractStage;
  /** 0..1 when known */
  progress?: number;
  page?: number;
  pages?: number;
}

export interface ExtractResult {
  text: string;
  pages: number;
  usedOcr: boolean;
  /** Pages skipped because the OCR page limit was reached. */
  skippedPages: number;
}

export class ExtractError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
  }
}

export const MAX_FILE_BYTES = 30 * 1024 * 1024;
const OCR_PAGE_LIMIT = 25;
const TEXT_TYPES = /\.(txt|md|markdown|csv|tsv|rtf|html?)$/i;
const IMAGE_TYPES = /\.(png|jpe?g|webp|bmp|gif)$/i;

export const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.tsv,.html,.htm,.png,.jpg,.jpeg,.webp,.bmp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*";

export function describeFile(file: File): "pdf" | "docx" | "text" | "image" | "unsupported" {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (IMAGE_TYPES.test(name) || file.type.startsWith("image/")) return "image";
  if (TEXT_TYPES.test(name) || file.type.startsWith("text/")) return "text";
  return "unsupported";
}

type Signal = { aborted: boolean };

export async function extractText(file: File, onProgress: (p: ExtractProgress) => void, signal: Signal = { aborted: false }): Promise<ExtractResult> {
  if (file.size === 0) throw new ExtractError("This file is empty.", "Choose a file that has some text in it.");
  if (file.size > MAX_FILE_BYTES) throw new ExtractError(`This file is ${(file.size / 1024 / 1024).toFixed(0)} MB, over the 30 MB limit.`, "Split it into smaller parts, or export just the chapters you need.");

  const kind = describeFile(file);
  if (kind === "unsupported") {
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "This";
    throw new ExtractError(`${ext} files aren't supported yet.`, ext === "DOC" ? "Save it as .docx or PDF, then try again." : ext === "PPTX" || ext === "PPT" ? "Export the slides as a PDF, then try again." : "Use a PDF, Word (.docx), text file, or a photo of your notes.");
  }

  onProgress({ stage: "reading" });

  if (kind === "text") {
    let text = await file.text();
    if (/\.html?$/i.test(file.name)) text = new DOMParser().parseFromString(text, "text/html").body.innerText;
    return { text, pages: 1, usedOcr: false, skippedPages: 0 };
  }

  if (kind === "docx") {
    const mammoth = await import("mammoth");
    try {
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return { text: value, pages: 1, usedOcr: false, skippedPages: 0 };
    } catch {
      throw new ExtractError("This Word document couldn't be opened.", "It may be damaged or password-protected. Try exporting it as PDF.");
    }
  }

  if (kind === "image") {
    const text = await ocrImages([file], onProgress, signal);
    return { text, pages: 1, usedOcr: true, skippedPages: 0 };
  }

  return readPdf(file, onProgress, signal);
}

async function readPdf(file: File, onProgress: (p: ExtractProgress) => void, signal: Signal): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") throw new ExtractError("This PDF is password-protected.", "Remove the password (print to PDF works), then try again.");
    throw new ExtractError("This PDF couldn't be opened.", "It may be damaged. Try re-saving or re-exporting it.");
  }

  const pages = doc.numPages;
  const texts: string[] = [];
  const emptyPages: number[] = [];
  for (let i = 1; i <= pages; i++) {
    if (signal.aborted) throw new ExtractError("Cancelled.");
    onProgress({ stage: "reading", page: i, pages, progress: i / pages });
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      pageText += item.str + (item.hasEOL ? "\n" : " ");
    }
    texts.push(pageText);
    if (pageText.replace(/\s/g, "").length < 40) emptyPages.push(i);
  }

  // Scanned PDFs have no text layer: render those pages and read them with OCR.
  let usedOcr = false;
  let skippedPages = 0;
  if (emptyPages.length > 0 && emptyPages.length >= pages * 0.5) {
    usedOcr = true;
    const toRead = emptyPages.slice(0, OCR_PAGE_LIMIT);
    skippedPages = emptyPages.length - toRead.length;
    const canvases: HTMLCanvasElement[] = [];
    for (const n of toRead) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport } as Parameters<typeof page.render>[0]).promise;
      canvases.push(canvas);
    }
    const ocr = await ocrImages(canvases, onProgress, signal);
    await doc.destroy();
    return { text: [texts.filter((_, i) => !emptyPages.includes(i + 1)).join("\n\n"), ocr].filter(Boolean).join("\n\n"), pages, usedOcr, skippedPages };
  }

  await doc.destroy();
  return { text: texts.join("\n\n"), pages, usedOcr, skippedPages };
}

async function ocrImages(images: (File | HTMLCanvasElement)[], onProgress: (p: ExtractProgress) => void, signal: Signal): Promise<string> {
  onProgress({ stage: "loading-ocr" });
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress({ stage: "ocr", page: current + 1, pages: images.length, progress: (current + m.progress) / images.length });
      },
    });
  } catch {
    throw new ExtractError("Text recognition couldn't start.", "The first scan downloads the reader (about 10 MB). Check your connection and try again.");
  }
  try {
    const out: string[] = [];
    for (let i = 0; i < images.length; i++) {
      if (signal.aborted) throw new ExtractError("Cancelled.");
      current = i;
      const { data } = await worker.recognize(images[i]);
      out.push(data.text);
    }
    return out.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
