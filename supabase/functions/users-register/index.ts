import { createAdminClient } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

const VALID_LOCALES = ["zh-CN", "en-GB"];
const VALID_REGIONS = ["CN", "UK", "NORDIC", "OTHER"];

Deno.serve(async (req) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // Only POST allowed
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed", 405);
  }

  try {
    const body = await req.json();
    const { device_id, locale, region } = body;

    // --- Validation ---
    if (!device_id || typeof device_id !== "string") {
      return errorResponse(
        "VALIDATION_ERROR",
        "device_id is required and must be a string",
        422,
      );
    }

    if (!locale || !VALID_LOCALES.includes(locale)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `locale must be one of: ${VALID_LOCALES.join(", ")}`,
        422,
      );
    }

    if (!region || !VALID_REGIONS.includes(region)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `region must be one of: ${VALID_REGIONS.join(", ")}`,
        422,
      );
    }

    const supabase = createAdminClient();

    // --- Check if device already registered ---
    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("device_id", device_id)
      .single();

    if (existing) {
      // Idempotent: return existing user with 200
      return jsonResponse(existing, 200);
    }

    // --- Create new user ---
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ device_id, locale, region })
      .select()
      .single();

    if (error) {
      console.error("Insert user error:", error);
      return errorResponse("INTERNAL_ERROR", "Failed to create user", 500);
    }

    return jsonResponse(newUser, 201);
  } catch (err) {
    console.error("users-register error:", err);
    return errorResponse("INTERNAL_ERROR", "Invalid request body", 400);
  }
});
