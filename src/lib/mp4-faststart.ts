/**
 * "Fast start" for MP4 / MOV files, done in the browser without re-encoding (no quality loss, takes well under a second).
 *
 * Phones usually write the movie index (the `moov` box) at the END of the file. A browser then has to download almost the
 * whole video before it can play the first frame, which is a large part of the "video starts late" problem. This moves
 * `moov` to the front and shifts the chunk offsets stored inside it, exactly like `ffmpeg -movflags +faststart`.
 *
 * Anything unusual (already fast, fragmented, compressed index, 4GB offsets, unreadable) returns the original file untouched.
 */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
const u32 = (v: DataView, o: number) => v.getUint32(o);
const type4 = (v: DataView, o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

type Box = { type: string; start: number; size: number };

/** Reads the top-level boxes of the file. Returns null when the structure is not understood. */
async function topLevelBoxes(file: Blob): Promise<Box[] | null> {
  const boxes: Box[] = [];
  let pos = 0;
  while (pos + 8 <= file.size && boxes.length < 64) {
    const head = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    let size = u32(head, 0);
    const type = type4(head, 4);
    if (size === 1) { if (head.byteLength < 16) return null; const big = head.getBigUint64(8); if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null; size = Number(big); }
    else if (size === 0) size = file.size - pos;
    if (size < 8 || pos + size > file.size) return null;
    boxes.push({ type, start: pos, size });
    pos += size;
  }
  return pos === file.size ? boxes : null;
}

/** Adds `delta` to every chunk offset (stco / co64) that points before `limit`. Returns false when it cannot be done safely. */
function shiftOffsets(view: DataView, start: number, end: number, delta: number, limit: number): boolean {
  let pos = start;
  while (pos + 8 <= end) {
    let size = u32(view, pos);
    const type = type4(view, pos + 4);
    let header = 8;
    if (size === 1) { size = Number(view.getBigUint64(pos + 8)); header = 16; }
    if (size < header || pos + size > end) return false;
    const body = pos + header;
    if (CONTAINERS.has(type)) {
      if (!shiftOffsets(view, body, pos + size, delta, limit)) return false;
    } else if (type === 'stco') {
      const count = u32(view, body + 4);
      if (body + 8 + count * 4 > pos + size) return false;
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * 4, value = u32(view, at);
        if (value >= limit) continue;
        if (value + delta > 0xffffffff) return false;
        view.setUint32(at, value + delta);
      }
    } else if (type === 'co64') {
      const count = u32(view, body + 4);
      if (body + 8 + count * 8 > pos + size) return false;
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * 8, value = view.getBigUint64(at);
        if (value >= BigInt(limit)) continue;
        view.setBigUint64(at, value + BigInt(delta));
      }
    }
    pos += size;
  }
  return true;
}

/** Returns a copy of the file whose index is at the front, or the same file when that is not needed or not possible. */
export async function faststartMp4(file: File): Promise<File> {
  try {
    if (!/\.(mp4|m4v|mov)$/i.test(file.name) && !/^video\/(mp4|quicktime)$/.test(file.type)) return file;
    const boxes = await topLevelBoxes(file);
    if (!boxes || boxes[0]?.type !== 'ftyp') return file;
    const moov = boxes.find(b => b.type === 'moov'), mdat = boxes.find(b => b.type === 'mdat');
    if (!moov || !mdat || boxes.some(b => b.type === 'moof')) return file;
    if (moov.start < mdat.start) return file; // already at the front
    if (moov.size > 64 * 1024 * 1024) return file;
    const moovBytes = await file.slice(moov.start, moov.start + moov.size).arrayBuffer();
    const view = new DataView(moovBytes);
    if (type4(view, 4) !== 'moov') return file;
    // a compressed index (cmov) cannot be edited in place
    const head = new Uint8Array(moovBytes);
    for (let i = 8; i + 4 <= head.length; i++) if (head[i] === 0x63 && head[i + 1] === 0x6d && head[i + 2] === 0x6f && head[i + 3] === 0x76) return file;
    const insertAt = boxes[0].start + boxes[0].size;
    if (!shiftOffsets(view, 8, moov.size, moov.size, moov.start)) return file;
    const out = new Blob([file.slice(0, insertAt), moovBytes, file.slice(insertAt, moov.start), file.slice(moov.start + moov.size)], { type: file.type });
    if (out.size !== file.size) return file;
    return new File([out], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
