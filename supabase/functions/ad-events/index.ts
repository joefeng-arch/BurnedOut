// Ad events ingestion (IAA funnel tracking).
// POST /ad-events
//   Single: { ad_type, stage, unlock_type?, is_completed?, session_id, page_name? }
//   Batch:  { events: [...] }

import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const AD_TYPES = ["reward", "interstitial", "native"] as const;
const AD_STAGES = [
  "request",
  "fill_success",
  "fill_fail",
  "show",
  "close",
  "reward_grant",
  "reward_use",
] as const;
const UNLOCK_TYPES = [
  "extra_vent",
  "advanced_destroy",
  "weekly_report",
  "share_card",
  "comeback_template",
] as const;

interface AdEvent {
  ad_type: string;
  stage: string;
  session_id: string;
  unlock_type?: string;
  is_completed?: boolean;
  page_name?: string;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  const deviceId = getDeviceId(req);
  if (!deviceId) return errorResponse("unauthorized", "X-Device-ID required", 401);
  const user = await getUserByDeviceId(deviceId);
  if (!user) return errorResponse("not_found", "User not registered", 404);

  let body: { events?: AdEvent[] } & Partial<AdEvent>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON", 400);
  }

  const events: AdEvent[] = Array.isArray(body.events) && body.events.length > 0
    ? body.events
    : body.ad_type && body.stage && body.session_id
    ? [body as AdEvent]
    : [];

  if (events.length === 0) {
    return errorResponse("bad_request", "events[] or single event required", 400);
  }

  const rows = events
    .filter((e) =>
      e.ad_type && e.stage && e.session_id &&
      (AD_TYPES as readonly string[]).includes(e.ad_type) &&
      (AD_STAGES as readonly string[]).includes(e.stage)
    )
    .map((e) => ({
      user_id: user.id,
      session_id: e.session_id,
      ad_type: e.ad_type,
      stage: e.stage,
      unlock_type:
        e.unlock_type && (UNLOCK_TYPES as readonly string[]).includes(e.unlock_type)
          ? e.unlock_type
          : null,
      is_completed: e.is_completed ?? null,
      page_name: e.page_name ?? null,
    }));

  if (rows.length === 0) {
    return errorResponse("bad_request", "No valid ad events", 400);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("ad_events").insert(rows);
  if (error) {
    console.error("ad-events insert failed", error);
    return errorResponse("internal", error.message, 500);
  }

  return jsonResponse({ accepted: rows.length }, 201);
});
