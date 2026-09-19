import type { PlaybackMode } from "../types";

export interface ClaudeScriptResult {
  ok: boolean;
  text: string;
}

/**
 * Calls the /api/claude serverless function (see functions/api/claude.ts) rather than
 * Anthropic directly -- the API key lives only on the server side. Only excerpted manuscript
 * text is sent, never the full private manuscript body.
 */
export async function generateScript(
  manuscriptText: string,
  title: string,
  mode: Exclude<PlaybackMode, "read">
): Promise<ClaudeScriptResult> {
  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, title, excerpt: manuscriptText })
    });

    const data = (await response.json()) as { text?: string; error?: string };
    if (!response.ok || data.error) {
      return { ok: false, text: data.error ?? `Request failed (${response.status})` };
    }
    return { ok: true, text: data.text ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { ok: false, text: message };
  }
}
