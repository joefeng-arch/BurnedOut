import { createAdminClient } from "../_shared/supabase.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

const VALID_LOCALES = ["zh-CN", "en-GB"];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is allowed", 405);
  }

  try {
    const url = new URL(req.url);
    const locale = url.searchParams.get("locale") || "zh-CN";

    if (!VALID_LOCALES.includes(locale)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `locale must be one of: ${VALID_LOCALES.join(", ")}`,
        422,
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_random_quip", {
      target_locale: locale,
    });

    if (error) {
      console.error("get_random_quip error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch quip",
        500,
      );
    }

    if (!data) {
      return errorResponse(
        "NOT_FOUND",
        `No quips available for locale: ${locale}`,
        404,
      );
    }

    return jsonResponse(data);
  } catch (err) {
    console.error("quips-random error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
});
