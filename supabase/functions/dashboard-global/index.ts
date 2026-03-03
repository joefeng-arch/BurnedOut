import { createAdminClient } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is allowed", 405);
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_global_stats");

    if (error) {
      console.error("get_global_stats error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch global stats",
        500,
      );
    }

    return jsonResponse(data);
  } catch (err) {
    console.error("dashboard-global error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
});
