// Check-ins API
// POST   /check-ins          — create today's check-in (1 per user per day)
// GET    /check-ins/today    — today's check-in if exists
// GET    /check-ins/history  — paginated history

import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const EMOTION_TAGS = ["tired", "annoyed", "angry", "empty", "sad"] as const;
type EmotionTag = typeof EMOTION_TAGS[number];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const deviceId = getDeviceId(req);
  if (!deviceId) return errorResponse("unauthorized", "X-Device-ID required", 401);

  const user = await getUserByDeviceId(deviceId);
  if (!user) return errorResponse("not_found", "User not registered", 404);

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean).pop() ?? "";

  const supabase = createAdminClient();

  // POST /check-ins
  if (req.method === "POST") {
    let body: { burn_level?: number; emotion_tags?: string[] };
    try {
      body = await req.json();
    } catch {
      return errorResponse("bad_request", "Invalid JSON", 400);
    }

    if (!body.burn_level || body.burn_level < 1 || body.burn_level > 5) {
      return errorResponse("bad_request", "burn_level must be 1-5", 400);
    }

    const tags = (body.emotion_tags ?? []).filter((t): t is EmotionTag =>
      (EMOTION_TAGS as readonly string[]).includes(t)
    );

    const { data, error } = await supabase
      .from("check_ins")
      .insert({
        user_id: user.id,
        burn_level: body.burn_level,
        emotion_tags: tags,
      })
      .select()
      .single();

    if (error) {
      // Unique violation = already checked in today
      if (error.code === "23505") {
        return errorResponse("conflict", "Already checked in today", 409);
      }
      console.error("check-ins insert failed", error);
      return errorResponse("internal", error.message, 500);
    }

    // Compute streak on the fly
    const { data: streakData } = await supabase.rpc("get_user_streak", { p_user_id: user.id });
    return jsonResponse({ check_in: data, streak: streakData ?? 1 }, 201);
  }

  // GET /check-ins/today
  if (req.method === "GET" && path === "today") {
    const { data } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", new Date().toISOString().slice(0, 10))
      .maybeSingle();
    return jsonResponse({ check_in: data });
  }

  // GET /check-ins/history?limit=&offset=
  if (req.method === "GET" && path === "history") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30"), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const { data, error } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return errorResponse("internal", error.message, 500);
    return jsonResponse({ check_ins: data ?? [], limit, offset });
  }

  return errorResponse("not_found", "Route not found", 404);
});
