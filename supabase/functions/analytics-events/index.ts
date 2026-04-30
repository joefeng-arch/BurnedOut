// Analytics events ingestion.
// POST /analytics-events
//   Single event: { event_name, page_name?, properties?, session_id, ... }
//   Batch (preferred from client): { events: [...] }
//
// Used for all PRD 埋点 events (home_view, vent_submit_click, etc).
// Client is expected to buffer events and flush in batches of up to 20.

import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const MAX_BATCH = 50;

interface AnalyticsEvent {
  event_name: string;
  session_id: string;
  page_name?: string;
  properties?: Record<string, unknown>;
  app_version?: string;
  lang?: string;
  network_type?: string;
  channel?: string;
  is_new_user?: boolean;
  day_index?: number;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  const deviceId = getDeviceId(req);
  // Analytics allowed pre-registration (user_id stays NULL)
  const user = deviceId ? await getUserByDeviceId(deviceId) : null;

  let body: { events?: AnalyticsEvent[] } & Partial<AnalyticsEvent>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON", 400);
  }

  const events: AnalyticsEvent[] = Array.isArray(body.events) && body.events.length > 0
    ? body.events
    : body.event_name && body.session_id
    ? [body as AnalyticsEvent]
    : [];

  if (events.length === 0) {
    return errorResponse("bad_request", "events[] or single event required", 400);
  }
  if (events.length > MAX_BATCH) {
    return errorResponse("bad_request", `Max ${MAX_BATCH} events per batch`, 400);
  }

  // Validate + normalize
  const rows = events
    .filter((e) => e.event_name && e.session_id)
    .map((e) => ({
      user_id: user?.id ?? null,
      session_id: e.session_id,
      event_name: e.event_name,
      page_name: e.page_name ?? null,
      properties: e.properties ?? {},
      app_version: e.app_version ?? null,
      lang: e.lang ?? null,
      network_type: e.network_type ?? null,
      channel: e.channel ?? null,
      is_new_user: e.is_new_user ?? null,
      day_index: e.day_index ?? null,
    }));

  if (rows.length === 0) {
    return errorResponse("bad_request", "No valid events", 400);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("analytics_events").insert(rows);

  if (error) {
    console.error("analytics insert failed", error);
    return errorResponse("internal", error.message, 500);
  }

  return jsonResponse({ accepted: rows.length }, 201);
});
