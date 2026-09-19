/**
 * Cloudflare Pages Function: POST /api/claude
 *
 * The only server-side code in this project. Its entire job is to hold the Claude API key
 * (set as a Pages secret, never shipped to the browser) and forward Retell/Summary/Podcast
 * generation requests to Anthropic. Read-mode narration never calls this -- it never leaves
 * the browser at all.
 *
 * Porting to Netlify: move this file's body into netlify/functions/claude.ts, swap the
 * PagesFunction signature for a Netlify Handler(event) signature, and read the key from
 * process.env.CLAUDE_API_KEY instead of context.env -- the fetch-to-Anthropic logic below is
 * unchanged.
 */

interface Env {
  CLAUDE_API_KEY: string;
}

interface ClaudeRequestBody {
  mode: "retell" | "summary" | "podcast";
  title: string;
  excerpt: string;
}

const SYSTEM_PROMPTS: Record<ClaudeRequestBody["mode"], string> = {
  retell:
    "You retell manuscripts in a warm, first-person narrator voice, preserving plot, " +
    "characters, and tone while tightening pacing. Output only the retelling, no preamble.",
  summary:
    "You summarize manuscripts concisely and accurately for a listener who wants the key " +
    "events and ideas in a few minutes of narration. Output only the summary, no preamble.",
  podcast:
    "You write a two-host podcast script discussing this manuscript, alternating natural, " +
    "conversational turns between HOST_A and HOST_B. Prefix every line with 'HOST_A:' or " +
    "'HOST_B:' and nothing else -- no stage directions, no preamble."
};

const EXCERPT_CHAR_LIMIT = 12_000;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: ClaudeRequestBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { mode, title, excerpt } = body;
  if (!mode || !SYSTEM_PROMPTS[mode] || typeof excerpt !== "string") {
    return json({ error: "mode and excerpt are required" }, 400);
  }

  const apiKey = context.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return json({ error: "Claude API key not configured on the server" }, 500);
  }

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPTS[mode],
      messages: [
        {
          role: "user",
          content: `Title: ${title}\n\nManuscript excerpt:\n${excerpt.slice(0, EXCERPT_CHAR_LIMIT)}`
        }
      ]
    })
  });

  if (!anthropicResponse.ok) {
    const errorBody = await anthropicResponse.text();
    return json({ error: `Claude API error ${anthropicResponse.status}: ${errorBody}` }, 502);
  }

  const data: { content?: Array<{ type: string; text?: string }> } = await anthropicResponse.json();
  const text = (data.content ?? []).map((block) => block.text ?? "").join("\n");

  return json({ text });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
