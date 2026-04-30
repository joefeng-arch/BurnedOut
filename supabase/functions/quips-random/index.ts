// GET /quips-random?locale=zh-CN&mode=gentle&high_risk=false
// Returns a single random quip.
// Used by client to fetch loading-state messages or fallback copy.

import { createAdminClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("method_not_allowed", "GET only", 405);
  }

  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") ?? "zh-CN") as "zh-CN" | "en-GB";
  const mode = (url.searchParams.get("mode") ?? "gentle") as "savage" | "gentle" | "calm";
  const highRisk = url.searchParams.get("high_risk") === "true";

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_random_quip", {
    p_locale: locale,
    p_mode: mode,
    p_is_high_risk: highRisk,
  });

  if (error) return errorResponse("internal", error.message, 500);
  return jsonResponse({ quip: data ?? "" });
});
