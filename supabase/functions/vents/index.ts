import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed", 405);
  }

  // --- Auth ---
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    return errorResponse("UNAUTHORIZED", "Missing X-Device-ID header", 401);
  }

  const user = await getUserByDeviceId(deviceId);
  if (!user) {
    return errorResponse("UNAUTHORIZED", "User not found. Register first.", 401);
  }

  try {
    const body = await req.json();
    const { char_count } = body;

    // Validate
    if (!Number.isInteger(char_count) || char_count < 1) {
      return errorResponse(
        "VALIDATION_ERROR",
        "char_count must be a positive integer",
        422,
      );
    }

    const supabase = createAdminClient();

    // --- Insert vent log (only char_count, NEVER the content) ---
    const { data: ventLog, error: ventError } = await supabase
      .from("vent_logs")
      .insert({ user_id: user.id, char_count })
      .select("id, char_count, created_at")
      .single();

    if (ventError) {
      console.error("Insert vent error:", ventError);
      return errorResponse("INTERNAL_ERROR", "Failed to record vent", 500);
    }

    // --- Fetch a random quip based on user's locale ---
    const url = new URL(req.url);
    const locale = url.searchParams.get("locale") || user.locale || "zh-CN";

    const { data: quip } = await supabase.rpc("get_random_quip", {
      target_locale: locale,
    });

    const quipText = quip?.text || (
      locale === "zh-CN"
        ? "销毁完成。地球还在转，你也还在。"
        : "Destruction complete. Earth still spinning. You're still here."
    );

    return jsonResponse(
      {
        id: ventLog.id,
        char_count: ventLog.char_count,
        quip: quipText,
        created_at: ventLog.created_at,
      },
      201,
    );
  } catch (err) {
    console.error("vents POST error:", err);
    return errorResponse("INTERNAL_ERROR", "Invalid request body", 400);
  }
});
