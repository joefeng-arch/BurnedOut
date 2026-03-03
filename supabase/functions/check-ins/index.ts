import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // --- Auth ---
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    return errorResponse("UNAUTHORIZED", "Missing X-Device-ID header", 401);
  }

  const user = await getUserByDeviceId(deviceId);
  if (!user) {
    return errorResponse("UNAUTHORIZED", "User not found. Register first.", 401);
  }

  const supabase = createAdminClient();
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // "check-ins", "today", "history"

  // ============================================================
  // POST /check-ins — Create today's check-in
  // ============================================================
  if (req.method === "POST" && (!path || path === "check-ins")) {
    try {
      const body = await req.json();
      const level = body.level;

      // Validate level
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        return errorResponse(
          "VALIDATION_ERROR",
          "level must be an integer between 1 and 5",
          422,
        );
      }

      // Check if already checked in today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();

      if (existing) {
        return errorResponse(
          "ALREADY_CHECKED_IN",
          "You have already checked in today. Come back tomorrow!",
          409,
        );
      }

      // Insert check-in
      const { data, error } = await supabase
        .from("check_ins")
        .insert({ user_id: user.id, level, date: today })
        .select()
        .single();

      if (error) {
        console.error("Insert check-in error:", error);
        return errorResponse("INTERNAL_ERROR", "Failed to create check-in", 500);
      }

      return jsonResponse(data, 201);
    } catch (err) {
      console.error("check-ins POST error:", err);
      return errorResponse("INTERNAL_ERROR", "Invalid request body", 400);
    }
  }

  // ============================================================
  // GET /check-ins/today — Get today's check-in
  // ============================================================
  if (req.method === "GET" && path === "today") {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (error || !data) {
      return errorResponse(
        "NOT_CHECKED_IN",
        "You haven't checked in today yet",
        404,
      );
    }

    return jsonResponse(data);
  }

  // ============================================================
  // GET /check-ins/history — Get paginated history
  // ============================================================
  if (req.method === "GET" && path === "history") {
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "30"), 1),
      100,
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") || "0"),
      0,
    );

    // Get total count
    const { count } = await supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Get paginated data
    const { data, error } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Check-in history error:", error);
      return errorResponse("INTERNAL_ERROR", "Failed to fetch history", 500);
    }

    return jsonResponse({
      data: data || [],
      total: count || 0,
      limit,
      offset,
    });
  }

  return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
});
