import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

const VALID_LOCALES = ["zh-CN", "en-GB"];
const VALID_REGIONS = ["CN", "UK", "NORDIC", "OTHER"];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // --- Auth: extract device ID ---
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    return errorResponse(
      "UNAUTHORIZED",
      "Missing X-Device-ID header",
      401,
    );
  }

  const user = await getUserByDeviceId(deviceId);
  if (!user) {
    return errorResponse("NOT_FOUND", "User not found", 404);
  }

  // --- GET: return profile ---
  if (req.method === "GET") {
    return jsonResponse(user);
  }

  // --- PATCH: update profile ---
  if (req.method === "PATCH") {
    try {
      const body = await req.json();
      const updates: Record<string, string> = {};

      if (body.locale !== undefined) {
        if (!VALID_LOCALES.includes(body.locale)) {
          return errorResponse(
            "VALIDATION_ERROR",
            `locale must be one of: ${VALID_LOCALES.join(", ")}`,
            422,
          );
        }
        updates.locale = body.locale;
      }

      if (body.region !== undefined) {
        if (!VALID_REGIONS.includes(body.region)) {
          return errorResponse(
            "VALIDATION_ERROR",
            `region must be one of: ${VALID_REGIONS.join(", ")}`,
            422,
          );
        }
        updates.region = body.region;
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          "At least one field (locale or region) must be provided",
          422,
        );
      }

      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Update user error:", error);
        return errorResponse("INTERNAL_ERROR", "Failed to update profile", 500);
      }

      return jsonResponse(data);
    } catch (err) {
      console.error("users-profile PATCH error:", err);
      return errorResponse("INTERNAL_ERROR", "Invalid request body", 400);
    }
  }

  return errorResponse("METHOD_NOT_ALLOWED", "Only GET and PATCH are allowed", 405);
});
