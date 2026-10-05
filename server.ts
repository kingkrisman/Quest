import express from "express";
import path from "path";

const isProd = process.env.NODE_ENV === "production" || process.argv.includes("--prod");
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.disable("x-powered-by");

  // Baseline security headers.
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Hashed build assets never change: cache them for a year. Everything else revalidates.
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y", fallthrough: false })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, file) => {
          if (/(index\.html|sw\.js|workbox-.*\.js|manifest\.webmanifest)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
        },
      })
    );
    // Client-side routes all serve the app shell.
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`KÀWÉ ${isProd ? "production" : "dev"} server on http://localhost:${PORT}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
