/**
 * Mux video helpers shared by the browser and the server.
 *
 * How a listing video flows:
 *  1. The seller's browser asks the server for a one-time Mux upload URL (createMuxUpload).
 *  2. The browser PUTs the original file straight to Mux (no in-browser re-encoding, no Supabase Storage).
 *  3. Until Mux finishes processing, posts.video_url holds a placeholder: "mux-upload:<ref>".
 *  4. Mux calls /api/mux-webhook when the video is ready. The webhook (and a database trigger, for the case where the
 *     post is saved after the video became ready) swap the placeholder for "https://stream.mux.com/<playbackId>.m3u8".
 *  5. The existing HLS player (src/lib/hls-loader.ts) plays that URL with adaptive bitrate.
 */
export const MUX_PENDING_PREFIX = 'mux-upload:';
const STREAM_RE = /^https:\/\/stream\.mux\.com\/[A-Za-z0-9]{8,80}\.m3u8$/;

/** A finished Mux stream URL that may be shown as-is (it is public and never needs signing). */
export const isMuxStreamUrl = (value: string | null | undefined): value is string => Boolean(value && STREAM_RE.test(value));

/** A video that was uploaded to Mux but is still being processed. */
export const isMuxPending = (value: string | null | undefined): value is string => Boolean(value?.startsWith(MUX_PENDING_PREFIX));

/** True for anything that is not a file in our own Supabase bucket (so it must not be signed or deleted from storage). */
export const isExternalVideo = (value: string | null | undefined): boolean => isMuxStreamUrl(value) || isMuxPending(value);

export const muxStreamUrl = (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`;
export const muxPending = (ref: string) => `${MUX_PENDING_PREFIX}${ref}`;
