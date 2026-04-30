// ============================================================================
// Sound effects — small wrapper around wx.createInnerAudioContext
// ============================================================================
//
// Why a wrapper:
//   1. Centralized opt-in (off by default; user toggles in /pages/smash and
//      /pages/destroy). Respects iOS mute switch via obeyMuteSwitch: true.
//   2. Graceful no-op when an mp3 file isn't bundled yet — prevents the
//      "can't play" error spam during dev.
//   3. Audio contexts pool so we don't recreate on every shake (perf).
//
// Storage:
//   sound_enabled = boolean (default false)

const storage = require('./storage.js');

const KEY_ENABLED = 'sound_enabled';

const pool = new Map(); // src -> InnerAudioContext

function isEnabled() {
  return !!storage.get(KEY_ENABLED, false);
}

function setEnabled(on) {
  storage.set(KEY_ENABLED, !!on);
}

function getOrCreate(src) {
  if (pool.has(src)) return pool.get(src);
  try {
    const ctx = wx.createInnerAudioContext({
      // iOS silent switch is respected — we don't want to embarrass users
      // in libraries / public transit when they forgot they enabled SFX.
      obeyMuteSwitch: true,
    });
    ctx.src = src;
    // Suppress noisy "file not found" errors during dev (when SFX assets
    // haven't been added yet). The wrapper still surfaces real I/O errors
    // via console.warn, just doesn't throw uncaught.
    ctx.onError((err) => {
      // err.errCode 10003 = network err; 10004 = decode err. Either way:
      // silent fail is the right UX (a missing sound shouldn't crash the
      // smash animation).
      console.warn('[sound] play failed', src, err);
    });
    pool.set(src, ctx);
    return ctx;
  } catch (e) {
    console.warn('[sound] context create failed', e);
    return null;
  }
}

/**
 * Play a sound effect. No-op if user has muted SFX or the file is missing.
 * Multiple rapid calls to the same src will restart playback (good for shake
 * spam — each plate gets its own crack).
 *
 * @param {string} src  Path under /assets/sounds (e.g. '/assets/sounds/plate-smash.mp3')
 */
function play(src) {
  if (!isEnabled()) return;
  if (!src) return;
  const ctx = getOrCreate(src);
  if (!ctx) return;
  try {
    // seek(0) lets us re-trigger the same effect even when a previous play
    // is still in-flight. stop() then play() is the documented pattern.
    ctx.stop();
    ctx.play();
  } catch (e) {
    console.warn('[sound] play threw', e);
  }
}

/**
 * Release all audio contexts. Call when the page hosting sounds unmounts.
 */
function disposeAll() {
  for (const ctx of pool.values()) {
    try { ctx.destroy(); } catch {}
  }
  pool.clear();
}

module.exports = {
  isEnabled,
  setEnabled,
  play,
  disposeAll,
};
