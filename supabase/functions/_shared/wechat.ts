// ============================================================================
// WeChat Mini Program API utilities
// - Fetches and caches access_token (in-memory per function instance)
// - Wraps msgSecCheck v2 content safety check
// ============================================================================

import { createAdminClient } from "./supabase.ts";

const WX_APPID = Deno.env.get("WX_APPID") ?? "";
const WX_SECRET = Deno.env.get("WX_SECRET") ?? "";

// In-memory cache — fine because access_token TTL is 7200s and cold starts are rare
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid access_token, refreshing if expired or near-expiry.
 * WeChat returns TTL=7200s; we refresh at 7000s to leave buffer.
 */
export async function getAccessToken(): Promise<string> {
  if (!WX_APPID || !WX_SECRET) {
    throw new Error("WX_APPID or WX_SECRET not configured");
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_SECRET}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (!data.access_token) {
    throw new Error(`WX access_token fetch failed: ${JSON.stringify(data)}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 200) * 1000,
  };
  return data.access_token;
}

export interface MsgSecCheckParams {
  content: string;
  openid?: string;   // wx user openid, required by WeChat
  scene?: 1 | 2 | 3 | 4; // 1=profile 2=comment 3=forum 4=social log
  nickname?: string;
}

export interface MsgSecCheckResult {
  pass: boolean;
  label?: number;       // WeChat label code (100=normal, 10001=ad, 20001=political...)
  suggest?: "pass" | "review" | "risky";
  raw?: unknown;
}

/**
 * Call WeChat msgSecCheck v2.
 * Returns pass=false when suggest === "risky" (or API fails open, configurable).
 *
 * Docs: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/msgSecCheck.html
 */
export async function msgSecCheck(
  params: MsgSecCheckParams,
): Promise<MsgSecCheckResult> {
  if (!params.content || params.content.trim().length === 0) {
    return { pass: true };
  }

  try {
    const token = await getAccessToken();
    const resp = await fetch(
      `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 2,
          scene: params.scene ?? 4,
          openid: params.openid ?? "",
          content: params.content,
          nickname: params.nickname ?? "",
        }),
      },
    );
    const data = await resp.json();

    // errcode 0 = accepted
    if (data.errcode !== 0 && data.errcode !== undefined) {
      // Fail open: if WeChat API errors, allow content but log
      console.warn("msgSecCheck API error", data);
      return { pass: true, raw: data };
    }

    const suggest: string = data.result?.suggest ?? "pass";
    const label: number = data.result?.label ?? 100;

    return {
      pass: suggest === "pass",
      label,
      suggest: suggest as "pass" | "review" | "risky",
      raw: data,
    };
  } catch (err) {
    console.error("msgSecCheck exception", err);
    // Fail open so backend outage doesn't block users
    return { pass: true };
  }
}

/**
 * Exchange wx.login code for openid via Supabase (optional helper).
 * Not used in V1 since we use device_id for anonymous identity.
 */
export async function code2Session(code: string): Promise<{ openid: string; session_key: string } | null> {
  if (!WX_APPID || !WX_SECRET) return null;
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.openid) return null;
  return { openid: data.openid, session_key: data.session_key };
}

// Re-export for convenience
export { createAdminClient };
