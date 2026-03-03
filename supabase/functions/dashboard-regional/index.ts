import { createAdminClient } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

const VALID_REGIONS = ["CN", "UK", "NORDIC", "OTHER"];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is allowed", 405);
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    const supabase = createAdminClient();

    // ============================================================
    // GET /dashboard-regional?region=CN — Single region stats
    // ============================================================
    if (path === "dashboard-regional") {
      const region = url.searchParams.get("region");

      if (!region || !VALID_REGIONS.includes(region)) {
        return errorResponse(
          "VALIDATION_ERROR",
          `region query parameter is required and must be one of: ${VALID_REGIONS.join(", ")}`,
          422,
        );
      }

      const { data, error } = await supabase.rpc("get_regional_stats", {
        target_region: region,
      });

      if (error) {
        console.error("get_regional_stats error:", error);
        return errorResponse(
          "INTERNAL_ERROR",
          "Failed to fetch regional stats",
          500,
        );
      }

      return jsonResponse(data);
    }

    // ============================================================
    // GET /dashboard-regional/all — All regions stats
    // ============================================================
    if (path === "all") {
      const { data, error } = await supabase.rpc("get_all_regional_stats");

      if (error) {
        console.error("get_all_regional_stats error:", error);
        return errorResponse(
          "INTERNAL_ERROR",
          "Failed to fetch all regional stats",
          500,
        );
      }

      return jsonResponse(data);
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (err) {
    console.error("dashboard-regional error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
});
