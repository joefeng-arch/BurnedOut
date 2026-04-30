// Vents API — the core "发泄" endpoint
//
// POST /vents
//   Body: {
//     content: string,           // raw text, used ONLY for msgSecCheck, NEVER stored
//     emotion_tags: string[],
//     vent_mode: "quick_rant" | "polite_rage" | "late_night",
//     destroy_type: "shredder" | "fire" | "black_hole" | "garbage_truck",
//     unlocked_by_ad?: boolean,
//     openid?: string            // optional; used by msgSecCheck
//   }
//   Returns: { vent_log, quip, is_flagged, today_vent_count }
//
//   Frequency rule:
//     - default 3 free vents/day
//     - +1 per watched reward video, max 3 extra → total cap 6/day
//
// GET /vents/today-count  — { free: n, unlocked: n, total: n, max: 6 }

import { createAdminClient, getDeviceId, getUserByDeviceId } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { msgSecCheck } from "../_shared/wechat.ts";

const FREE_LIMIT = 3;
const MAX_AD_UNLOCKS = 3;

const EMOTION_TAGS = ["tired", "annoyed", "angry", "empty", "sad"] as const;
const VENT_MODES = ["quick_rant", "polite_rage", "late_night"] as const;
const DESTROY_TYPES = ["shredder", "fire", "black_hole", "garbage_truck"] as const;

type VentMode = typeof VENT_MODES[number];

// Map vent_mode -> quip mode_tag
const MODE_TO_QUIP: Record<VentMode, "savage" | "gentle" | "calm"> = {
  quick_rant: "savage",
  polite_rage: "savage",
  late_night: "gentle",
};

function bucketChars(len: number): string {
  if (len <= 20) return "bucket_1_20";
  if (len <= 50) return "bucket_21_50";
  if (len <= 100) return "bucket_51_100";
  return "bucket_100_plus";
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const deviceId = getDeviceId(req);
  if (!deviceId) return errorResponse("unauthorized", "X-Device-ID required", 401);
  const user = await getUserByDeviceId(deviceId);
  if (!user) return errorResponse("not_found", "User not registered", 404);

  const supabase = createAdminClient();
  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean).pop() ?? "";

  // GET /vents/today-count
  if (req.method === "GET" && path === "today-count") {
    const { data: free } = await supabase.rpc("count_today_vents", {
      p_user_id: user.id,
      p_unlocked_by_ad: false,
    });
    const { data: unlocked } = await supabase.rpc("count_today_vents", {
      p_user_id: user.id,
      p_unlocked_by_ad: true,
    });
    return jsonResponse({
      free: free ?? 0,
      unlocked: unlocked ?? 0,
      total: (free ?? 0) + (unlocked ?? 0),
      free_limit: FREE_LIMIT,
      max_ad_unlocks: MAX_AD_UNLOCKS,
      remaining_free: Math.max(0, FREE_LIMIT - (free ?? 0)),
      remaining_unlocks: Math.max(0, MAX_AD_UNLOCKS - (unlocked ?? 0)),
    });
  }

  // POST /vents
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  let body: {
    content?: string;
    emotion_tags?: string[];
    vent_mode?: string;
    destroy_type?: string;
    unlocked_by_ad?: boolean;
    openid?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON", 400);
  }

  const content = (body.content ?? "").trim();
  if (!content) return errorResponse("bad_request", "content required", 400);

  if (!VENT_MODES.includes(body.vent_mode as typeof VENT_MODES[number])) {
    return errorResponse("bad_request", "invalid vent_mode", 400);
  }
  if (!DESTROY_TYPES.includes(body.destroy_type as typeof DESTROY_TYPES[number])) {
    return errorResponse("bad_request", "invalid destroy_type", 400);
  }

  const ventMode = body.vent_mode as VentMode;
  const destroyType = body.destroy_type as typeof DESTROY_TYPES[number];
  const unlockedByAd = !!body.unlocked_by_ad;
  const tags = (body.emotion_tags ?? []).filter((t) =>
    (EMOTION_TAGS as readonly string[]).includes(t)
  );

  // Frequency limit
  const { data: freeCount } = await supabase.rpc("count_today_vents", {
    p_user_id: user.id,
    p_unlocked_by_ad: false,
  });
  const { data: unlockedCount } = await supabase.rpc("count_today_vents", {
    p_user_id: user.id,
    p_unlocked_by_ad: true,
  });

  if (!unlockedByAd && (freeCount ?? 0) >= FREE_LIMIT) {
    return errorResponse(
      "rate_limit",
      "Free vents exhausted. Watch a reward video to unlock extra.",
      429,
    );
  }
  if (unlockedByAd && (unlockedCount ?? 0) >= MAX_AD_UNLOCKS) {
    return errorResponse("rate_limit", "Max ad-unlocked vents reached for today.", 429);
  }

  // Content safety — fail open if WeChat API errors
  const secResult = await msgSecCheck({
    content,
    openid: body.openid,
    scene: 4,
  });
  const isFlagged = !secResult.pass;

  // Write log — NEVER store content
  const { data: ventLog, error } = await supabase
    .from("vent_logs")
    .insert({
      user_id: user.id,
      char_count_bucket: bucketChars([...content].length),
      emotion_tags: tags,
      vent_mode: ventMode,
      destroy_type: destroyType,
      unlocked_by_ad: unlockedByAd,
      is_flagged: isFlagged,
    })
    .select()
    .single();

  if (error) {
    console.error("vent insert failed", error);
    return errorResponse("internal", error.message, 500);
  }

  // Return a quip matched to the mode; if flagged, use high-risk fallback
  const quipMode = MODE_TO_QUIP[ventMode];
  const { data: quip } = await supabase.rpc("get_random_quip", {
    p_locale: user.locale,
    p_mode: isFlagged ? "gentle" : quipMode,
    p_is_high_risk: isFlagged,
  });

  return jsonResponse(
    {
      vent_log: ventLog,
      quip: quip ?? "",
      is_flagged: isFlagged,
      today_vent_count: (freeCount ?? 0) + (unlockedCount ?? 0) + 1,
    },
    201,
  );
});
