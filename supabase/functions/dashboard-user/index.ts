// Personal dashboard (replaces V1 dashboard-global / dashboard-regional).
// GET /dashboard-user
// Returns aggregated stats used by the Trend page:
//   - 7-day burn level trend
//   - emotion distribution this week
//   - current streak
//   - peak pressure hours
//   - this week vs last week delta

import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("method_not_allowed", "GET only", 405);
  }

  const deviceId = getDeviceId(req);
  if (!deviceId) return errorResponse("unauthorized", "X-Device-ID required", 401);
  const user = await getUserByDeviceId(deviceId);
  if (!user) return errorResponse("not_found", "User not registered", 404);

  const supabase = createAdminClient();

  const [trendRes, emotionsRes, streakRes, peakRes, deltaRes] = await Promise.all([
    supabase.rpc("get_user_weekly_trend", { p_user_id: user.id }),
    supabase.rpc("get_user_weekly_emotions", { p_user_id: user.id }),
    supabase.rpc("get_user_streak", { p_user_id: user.id }),
    supabase.rpc("get_user_peak_hour", { p_user_id: user.id }),
    supabase.rpc("get_user_weekly_delta", { p_user_id: user.id }),
  ]);

  return jsonResponse({
    trend: trendRes.data ?? [],
    emotions: emotionsRes.data ?? [],
    streak: streakRes.data ?? 0,
    peak_hours: peakRes.data ?? [],
    weekly_delta: deltaRes.data?.[0] ?? { this_week_avg: 0, last_week_avg: 0, delta: 0 },
  });
});
