export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_MEDIA = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';
export type MediaKind = 'memory' | 'chat' | 'letter';
export function validateMedia(
  name: string,
  mime: string,
  size: number,
  head: Uint8Array,
  kind: MediaKind,
  duration?: number,
) {
  const ext = name.split('.').at(-1)?.toLowerCase();
  const type = mime.split(';')[0];
  if (!size || size > MAX_UPLOAD_BYTES) throw new Error('file_too_large');
  const start = (bytes: number[]) => bytes.every((b, i) => head[i] === b);
  const text = (at: number, length: number) =>
    new TextDecoder().decode(head.slice(at, at + length));
  const rules: Record<string, { extension: string; match: boolean; extensions: string[] }> = {
    'image/jpeg': { extension: 'jpg', match: start([255, 216, 255]), extensions: ['jpg', 'jpeg'] },
    'image/png': {
      extension: 'png',
      match: start([137, 80, 78, 71, 13, 10, 26, 10]),
      extensions: ['png'],
    },
    'image/webp': {
      extension: 'webp',
      match: text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP',
      extensions: ['webp'],
    },
    'video/mp4': { extension: 'mp4', match: text(4, 4) === 'ftyp', extensions: ['mp4'] },
    'video/webm': { extension: 'webm', match: start([26, 69, 223, 163]), extensions: ['webm'] },
    'audio/webm': { extension: 'webm', match: start([26, 69, 223, 163]), extensions: ['webm'] },
    'audio/ogg': { extension: 'ogg', match: text(0, 4) === 'OggS', extensions: ['ogg'] },
    'audio/mp4': { extension: 'm4a', match: text(4, 4) === 'ftyp', extensions: ['m4a', 'mp4'] },
    'audio/wav': {
      extension: 'wav',
      match: text(0, 4) === 'RIFF' && text(8, 4) === 'WAVE',
      extensions: ['wav'],
    },
  };
  const rule = rules[type];
  if (!rule || !rule.match || !ext || !rule.extensions.includes(ext))
    throw new Error('unsupported_media');
  if (kind === 'letter' && !type.startsWith('image/')) throw new Error('unsupported_media');
  if (
    type.startsWith('audio/') &&
    (kind !== 'chat' || !duration || duration < 1 || duration > 120000)
  )
    throw new Error('invalid_audio');
  return { extension: rule.extension, mime: type };
}
