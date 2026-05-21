import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAIInstance() {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("GEMINI_API_KEY environment variable is not set. AI features will not work.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export const quizGeneratorSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correctOptionIndex: { type: Type.INTEGER },
          points: { type: Type.INTEGER },
          timeLimit: { type: Type.INTEGER }
        },
        required: ["id", "text", "options", "correctOptionIndex"]
      }
    }
  },
  required: ["title", "description", "questions"]
};

export const flashcardSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
        },
        required: ["front", "back"]
      }
    }
  },
  required: ["title", "description", "cards"]
};

export async function generateQuizFromTopic(topicAndContent: string | { mimeType: string, data: string }[], count: number = 5, globalTimeLimit: number = 20) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Gemini API key is not configured. Please set the VITE_GEMINI_API_KEY environment variable to use AI features.");
  }

  const ai = getAIInstance();
  if (!ai) {
    throw new Error("Failed to initialize Gemini API. Please check your API key.");
  }

  let parts: any[] = [];
  if (typeof topicAndContent === "string") {
    parts.push({ text: `Generate a comprehensive and engaging quiz about "${topicAndContent}".` });
  } else if (topicAndContent.length > 0) {
    topicAndContent.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });
    parts.push({ text: "Generate a comprehensive and engaging quiz based on the provided documents." });
  } else {
    throw new Error("No topic or documents provided for quiz generation.");
  }

  parts.push({ text: `The quiz should have exactly ${count} questions. Each question must have a time limit of ${globalTimeLimit} seconds. Ensure there is a clear title and description. Each question should have 4 options and 1 correct answer. Focus on interesting facts and varied difficulty.` });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: quizGeneratorSchema as any,
      },
    });

    return JSON.parse(response.text);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error("Gemini API Error Details:", err);
    if (errorMsg.includes("API key") || errorMsg.includes("INVALID_ARGUMENT") || errorMsg.includes("403") || errorMsg.includes("401")) {
      throw new Error("Invalid or unauthorized Gemini API key. Please verify:\n1. Your VITE_GEMINI_API_KEY is correct\n2. The Generative Language API is enabled in Google Cloud\n3. The API key has not been restricted");
    }
    throw err;
  }
}

export async function generateFlashcards(topicAndContent: string | { mimeType: string, data: string }[], count: number = 10) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Gemini API key is not configured. Please set the VITE_GEMINI_API_KEY environment variable to use AI features.");
  }

  const ai = getAIInstance();
  if (!ai) {
    throw new Error("Failed to initialize Gemini API. Please check your API key.");
  }

  let parts: any[] = [];
  if (typeof topicAndContent === "string") {
    parts.push({ text: `Generate educational flashcards about "${topicAndContent}".` });
  } else if (topicAndContent.length > 0) {
    topicAndContent.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });
    parts.push({ text: "Generate educational flashcards based on the provided documents." });
  } else {
    throw new Error("No topic or documents provided for flashcard generation.");
  }

  parts.push({ text: `Generate exactly ${count} flashcards. Ensure there is a clear title for the set. Each card should have a clear concept or question on the 'front' and a concise explanation or answer on the 'back'.` });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: flashcardSchema as any,
      },
    });

    return JSON.parse(response.text);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error("Gemini API Error Details:", err);
    if (errorMsg.includes("API key") || errorMsg.includes("INVALID_ARGUMENT") || errorMsg.includes("403") || errorMsg.includes("401")) {
      throw new Error("Invalid or unauthorized Gemini API key. Please verify:\n1. Your VITE_GEMINI_API_KEY is correct\n2. The Generative Language API is enabled in Google Cloud\n3. The API key has not been restricted");
    }
    throw err;
  }
}
