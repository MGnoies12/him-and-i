import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import sharp from 'sharp';
import { inspectUpload } from '@/lib/server/validate-upload';
function wave(seconds: number) {
  const size = 8000 * 2 * seconds;
  const b = Buffer.alloc(44 + size);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + size, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(size, 40);
  return new Uint8Array(b);
}
describe('trusted content inspection (not just filename checks)', () => {
  it('decodes and normalizes valid images while stripping embedded metadata', async () => {
    const original = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#eba9bc' },
    })
      .withMetadata({ exif: { IFD0: { Artist: 'Synthetic test fixture' } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const result = await inspectUpload(new Uint8Array(original), 'image/jpeg');
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.width).toBe(16);
    expect(metadata.exif).toBeUndefined();
    expect(result.duration).toBeNull();
  });
  it('rejects malformed images even if their magic prefix looks right', async () => {
    await expect(
      inspectUpload(Uint8Array.from([255, 216, 255, 224, 0, 0, 0, 0]), 'image/jpeg'),
    ).rejects.toMatchObject({ code: 'unsupported_media' });
  });
  it('checks the parsed container duration rather than trusting the declared voice length', async () => {
    expect((await inspectUpload(wave(1), 'audio/wav', 1000)).duration).toBe(1000);
    await expect(inspectUpload(wave(121), 'audio/wav', 1000)).rejects.toMatchObject({
      code: 'invalid_audio',
    });
    await expect(inspectUpload(wave(1), 'audio/wav', 6000)).rejects.toMatchObject({
      code: 'invalid_audio',
    });
  });
});
