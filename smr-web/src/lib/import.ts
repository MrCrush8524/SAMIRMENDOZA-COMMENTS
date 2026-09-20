import type { Manuscript } from "./types";

/** Imports a plain-text manuscript from a browser File object. The text never leaves the
 * device except as short excerpts sent to Claude for Retell/Summary/Podcast generation. */
export async function importPlainText(file: File): Promise<Manuscript> {
  const text = await file.text();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const title = file.name.replace(/\.[^.]+$/, "");
  const id = crypto.randomUUID();

  return {
    id,
    title,
    sourceFileName: file.name,
    text,
    coverIsFallback: true,
    coverDataUrl: generateFallbackCover(title),
    importedAtEpochMs: Date.now(),
    wordCount,
    // Rough narration estimate at ~150 words/minute for the standard voice.
    durationEstimateSeconds: Math.round((wordCount / 150) * 60)
  };
}

/**
 * Automatic, copyright-safe fallback cover: a small generated gradient card with the
 * manuscript's initial, drawn on a canvas. No network lookup, no third-party artwork --
 * this always succeeds and never risks using someone else's unlicensed cover art.
 */
function generateFallbackCover(title: string): string {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#141b36");
  gradient.addColorStop(1, "#0d1326");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#aaa0d8";
  ctx.font = "700 220px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initial = title.trim().charAt(0).toUpperCase() || "S";
  ctx.fillText(initial, size / 2, size / 2 + 20);

  return canvas.toDataURL("image/png");
}
