// POST /users-register
// Body: { device_id, locale?, region? }
// Idempotent: returns existing user (200) or creates new (201).

import { createAdminClient } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  let body: { device_id?: string; locale?: string; region?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON", 400);
  }

  if (!body.device_id || typeof body.device_id !== "string") {
    return errorResponse("bad_request", "device_id required", 400);
  }

  const locale = body.locale ?? "zh-CN";
  const region = body.region ?? "CN";

  const supabase = createAdminClient();

  // Idempotent — check first
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("device_id", body.device_id)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ user: existing, created: false }, 200);
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ device_id: body.device_id, locale, region })
    .select()
    .single();

  if (error) {
    console.error("users-register insert failed", error);
    return errorResponse("internal", error.message, 500);
  }

  return jsonResponse({ user: data, created: true }, 201);
});
