// ============================================================================
// POST /ai-empathy
// ============================================================================
//
// Privacy-sensitive endpoint. Proxies a single empathy request to the bltcy.ai
// relay (which fronts deepseek-v4-flash etc). The vent text is sent ONCE to
// the upstream and never persisted — neither here, nor in the client. The
// home-page privacy copy makes this an opt-in promise; do not break it by
// adding logging of the raw text to this function.
//
// Body:   { vent_text: string, emotion_tags?: string[], vent_mode?: string,
//           locale?: 'zh-CN' | 'en-GB' }
// Return: { empathy: string, usage?: { prompt_tokens, completion_tokens } }
//
// Auth: relies on Supabase anon key (same as other functions). Real abuse
// guard is the per-device daily quota enforced client-side; if abuse spikes
// we'll add server-side rate-limit by X-Device-ID later.
//
// Required Supabase secret:
//   BLTCY_API_KEY  — Bearer token for api.bltcy.ai
//
// CORS helpers are intentionally inlined (not imported from ../_shared) so
// this function can be deployed via the Supabase Dashboard web editor, which
// only uploads the single file you paste — it does NOT bundle the _shared
// directory the way the CLI does. Keeping this file dependency-free means
// "Deploy a new function" → paste → done, no CLI needed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, message: string, status = 400): Response {
  return jsonResponse({ error, message }, status);
}

const BLTCY_URL = "https://api.bltcy.ai/v1/chat/completions";
const MODEL = "deepseek-v4-flash";

// Hard caps to control cost + latency. The vent text is the only user-controlled
// input; cap aggressively. 500 chars covers ~99% of normal vents.
const MAX_INPUT_CHARS = 500;
const MAX_OUTPUT_TOKENS = 120;
// 15s — DeepSeek cold-start + bltcy.ai relay overhead can easily exceed 8s.
// Supabase Edge Functions default request timeout is 60s so we have headroom.
const UPSTREAM_TIMEOUT_MS = 15000;

const SYSTEM_PROMPT_ZH = `你是一个温暖但不油腻的朋友。用户刚刚发泄了情绪,你要做的是:
- 共情他/她,不评价不教育
- 不说"你应该…"、"加油"、"想开点"这类空话
- 不给具体建议(除非用户问)
- 用 1-2 句话,中文,不要超过 60 字
- 语气像深夜里能听你抱怨的好友

只输出回应内容,不要前缀,不要"我理解你"这种套话开头。`;

const SYSTEM_PROMPT_EN = `You're a warm friend who listens without judging. The user just vented. Your job:
- Empathise, don't lecture
- Don't say "you should…", "stay strong", or other platitudes
- Don't give advice unless asked
- 1-2 sentences, English, under 30 words
- Tone: a friend who lets you complain at 2am

Output only the response. No "I understand" preamble.`;

interface RequestBody {
  vent_text?: string;
  emotion_tags?: string[];
  vent_mode?: string;
  locale?: "zh-CN" | "en-GB";
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON", 400);
  }

  const ventText = (body.vent_text ?? "").trim();
  if (!ventText) {
    return errorResponse("bad_request", "vent_text required", 400);
  }
  // Cap input length defensively
  const text = ventText.slice(0, MAX_INPUT_CHARS);

  const apiKey = Deno.env.get("BLTCY_API_KEY");
  if (!apiKey) {
    return errorResponse("not_configured", "AI key not set", 503);
  }

  const locale = body.locale === "en-GB" ? "en-GB" : "zh-CN";
  const systemPrompt = locale === "en-GB" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;

  // Light contextual framing for the model — gives it the emotion tags and
  // vent mode without polluting the user's actual words.
  const tags = (body.emotion_tags ?? []).slice(0, 5).join(", ");
  const ventMode = body.vent_mode ?? "";
  const userMsg = locale === "en-GB"
    ? `[mood: ${tags || "n/a"} | mode: ${ventMode || "n/a"}]\n${text}`
    : `[情绪: ${tags || "未标"} | 模式: ${ventMode || "未标"}]\n${text}`;

  try {
    const upstream = await fetch(BLTCY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => "");
      // Log status + a short snippet only — do NOT log the user's vent text
      console.error("bltcy upstream error", upstream.status, errBody.slice(0, 200));
      // Echo upstream status + body snippet back to caller for debug visibility.
      // Safe to expose: contains bltcy's error JSON (e.g. "model not found"),
      // never the user's vent text.
      return jsonResponse({
        error: "upstream_error",
        message: `AI request failed: ${upstream.status}`,
        upstream_status: upstream.status,
        upstream_body: errBody.slice(0, 200),
      }, 502);
    }

    const data = await upstream.json();
    // Try standard OpenAI shape first, then DeepSeek-R1 / reasoning-model
    // shape (content lives in reasoning_content), then a couple of relay
    // service variants we've seen in the wild.
    const empathy: string = (
      data?.choices?.[0]?.message?.content
      ?? data?.choices?.[0]?.message?.reasoning_content
      ?? data?.choices?.[0]?.text
      ?? data?.content
      ?? ""
    ).toString().trim();

    if (!empathy) {
      // Surface the actual response shape so we can adapt parsing without
      // another round-trip. Capped at 800 chars so we don't blow up the
      // toast/console with a giant payload.
      const rawSnippet = JSON.stringify(data ?? {}).slice(0, 800);
      console.error("ai-empathy empty content. Raw upstream response:", rawSnippet);
      return jsonResponse({
        error: "empty_response",
        message: "AI returned empty content",
        raw_response: rawSnippet,
      }, 502);
    }

    return jsonResponse({
      empathy,
      usage: data.usage ?? null,
    });
  } catch (err) {
    const name = (err as Error)?.name ?? "Error";
    // Do not leak err.message containing user input; just log generically
    console.error("ai-empathy fetch failed", name);
    // AbortError = our 15s timeout fired. Surface this distinctly so the
    // client can suggest "try again, the model is slow" vs. a real bug.
    const isTimeout = name === "TimeoutError" || name === "AbortError";
    return jsonResponse({
      error: isTimeout ? "upstream_timeout" : "internal",
      message: isTimeout
        ? `Upstream did not respond in ${UPSTREAM_TIMEOUT_MS}ms`
        : "Upstream call failed",
      error_name: name,
    }, isTimeout ? 504 : 500);
  }
});
