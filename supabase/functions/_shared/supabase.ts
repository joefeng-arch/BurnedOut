import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Create a Supabase admin client using the service_role key.
 * This bypasses RLS — use with caution and validate input manually.
 */
export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

/**
 * Extract device ID from the X-Device-ID header.
 * Returns null if missing.
 */
export function getDeviceId(req: Request): string | null {
  return req.headers.get("x-device-id");
}

/**
 * Lookup user by device_id. Returns the user row or null.
 */
export async function getUserByDeviceId(deviceId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("device_id", deviceId)
    .single();

  if (error || !data) return null;
  return data;
}
