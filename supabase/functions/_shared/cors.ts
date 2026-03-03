export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

/**
 * Handle CORS preflight request.
 * Return this early for OPTIONS method in every Edge Function.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create a JSON error response.
 */
export function errorResponse(
  error: string,
  message: string,
  status = 400,
): Response {
  return jsonResponse({ error, message }, status);
}
