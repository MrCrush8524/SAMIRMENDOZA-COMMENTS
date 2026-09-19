import { KokoroTTS } from "kokoro-js";
import type { ModelLoadState, Voice } from "../types";

/**
 * Wraps kokoro-js (transformers.js + onnxruntime-web under the hood) for fully client-side,
 * in-browser narration -- no server round-trip for synthesis, no manual "download the model"
 * step. The model is fetched transparently the first time narration is actually needed and
 * cached by the browser (Cache API, via transformers.js) so every load after the first is
 * instant. This is the one module that would change if the narration engine were ever swapped.
 */

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// q8 (int8) keeps the download to ~80-100MB instead of the ~320MB fp32 weights, while staying
// good enough quality for narration -- a meaningful trade for something fetched over the web.
const DTYPE = "q8";

type Listener = (state: ModelLoadState) => void;

let tts: KokoroTTS | null = null;
let loadPromise: Promise<KokoroTTS> | null = null;
let state: ModelLoadState = { status: "not-started" };
const listeners = new Set<Listener>();

function setState(next: ModelLoadState) {
  state = next;
  listeners.forEach((l) => l(state));
}

export function getModelLoadState(): ModelLoadState {
  return state;
}

export function subscribeModelLoadState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

/** Idempotent -- safe to call repeatedly; only actually loads once. */
export function ensureModelReady(): Promise<KokoroTTS> {
  if (tts) return Promise.resolve(tts);
  if (loadPromise) return loadPromise;

  setState({ status: "loading", progress: 0, file: "" });

  loadPromise = KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: DTYPE,
    device: "wasm",
    progress_callback: (data: any) => {
      if (data?.status === "progress") {
        const progress = data.total ? data.loaded / data.total : 0;
        setState({ status: "loading", progress, file: data.file ?? "" });
      }
    }
  })
    .then((instance) => {
      tts = instance;
      setState({ status: "ready" });
      return instance;
    })
    .catch((error: unknown) => {
      loadPromise = null;
      const message = error instanceof Error ? error.message : "Failed to load narration model";
      setState({ status: "failed", message });
      throw error;
    });

  return loadPromise;
}

export function listVoices(): Voice[] {
  if (!tts) return [];
  return Object.entries(tts.voices).map(([id, meta]: [string, any]) => ({
    id,
    displayName: `${meta.name}${meta.traits ? " " + meta.traits : ""} (${meta.gender})`
  }));
}

/**
 * Splits narration text into sentence-grouped chunks and synthesizes each as its own WAV blob,
 * in playback order. Chunking (rather than one giant call) keeps memory bounded on long
 * manuscripts and lets playback start before the whole thing finishes generating.
 */
export async function synthesize(
  text: string,
  voiceId: string,
  speed: number,
  onChunkReady?: (chunk: Blob, index: number, total: number) => void
): Promise<Blob[]> {
  const engine = await ensureModelReady();
  const chunks = chunkText(text);
  const blobs: Blob[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const audio = await engine.generate(chunks[i], { voice: voiceId as any, speed });
    const blob = audio.toBlob();
    blobs.push(blob);
    onChunkReady?.(blob, i, chunks.length);
  }

  return blobs;
}

function chunkText(text: string, maxChars = 400): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence + " ";
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}
