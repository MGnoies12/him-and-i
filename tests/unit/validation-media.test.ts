import { describe, it, expect } from 'vitest';
import { actionSchema, authSchema } from '@/schemas/actions';
import { validateMedia, MAX_UPLOAD_BYTES } from '@/lib/media';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
describe('validated mutations and auth forms', () => {
  it('requires strong sign-up passwords but does not silently change sign-in passwords', () => {
    expect(
      authSchema.safeParse({
        type: 'signup',
        email: 'test@example.com',
        password: 'short',
        display_name: 'Synthetic',
      }).success,
    ).toBe(false);
    expect(
      authSchema.parse({
        type: 'login',
        email: 'test@example.com',
        password: ' pass with spaces ',
      }),
    ).toMatchObject({ password: ' pass with spaces ' });
  });
  it('does not accept caller-chosen sender or couple identities', () => {
    const result = actionSchema.parse({
      type: 'message.send',
      id,
      body: 'test',
      sender_id: 'forged',
      couple_id: 'forged',
    });
    expect(result).not.toHaveProperty('sender_id');
    expect(result).not.toHaveProperty('couple_id');
  });
  it('bounds message size, game answers and invite token shape', () => {
    expect(
      actionSchema.safeParse({ type: 'message.send', id, body: 'x'.repeat(4001) }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({ type: 'game.answer', id, answer: 'x'.repeat(2001) }).success,
    ).toBe(false);
    expect(actionSchema.safeParse({ type: 'invitation.accept', token: 'guess' }).success).toBe(
      false,
    );
    expect(
      actionSchema.safeParse({ type: 'invitation.accept', token: 'A'.repeat(43) }).success,
    ).toBe(true);
  });
  it('requires independent explicit sharing choices and reminder consent', () => {
    expect(actionSchema.safeParse({ type: 'cycle.sharing', share_status: true }).success).toBe(
      false,
    );
    expect(
      actionSchema.safeParse({
        type: 'cycle.reminder.save',
        kind: 'log',
        due_at: '2026-10-25T09:00:00Z',
        timezone: 'Europe/London',
      }).success,
    ).toBe(false);
  });
  it('rejects executable music links and invalid timezones', () => {
    expect(
      actionSchema.safeParse({
        type: 'track.add',
        playlist_id: id,
        title: 'Test',
        artist: 'Test',
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({
        type: 'profile.save',
        display_name: 'Test',
        locale: 'fa',
        timezone: 'Moon/Test',
      }).success,
    ).toBe(false);
  });
});
describe('media upload boundary', () => {
  const jpeg = Uint8Array.from([255, 216, 255, 224]);
  it('requires a matching extension, type and binary signature', () => {
    expect(validateMedia('test.jpeg', 'image/jpeg', 100, jpeg, 'memory')).toEqual({
      extension: 'jpg',
      mime: 'image/jpeg',
    });
    expect(() => validateMedia('test.png', 'image/png', 100, jpeg, 'memory')).toThrow(
      'unsupported_media',
    );
    expect(() => validateMedia('test.html', 'image/jpeg', 100, jpeg, 'memory')).toThrow(
      'unsupported_media',
    );
  });
  it('rejects SVG and oversized private files', () => {
    expect(() =>
      validateMedia('evil.svg', 'image/svg+xml', 100, new TextEncoder().encode('<svg/>'), 'memory'),
    ).toThrow('unsupported_media');
    expect(() =>
      validateMedia('huge.jpg', 'image/jpeg', MAX_UPLOAD_BYTES + 1, jpeg, 'memory'),
    ).toThrow('file_too_large');
  });
  it('validates voice duration, format, and use context', () => {
    const head = Uint8Array.from([26, 69, 223, 163]);
    expect(
      validateMedia('voice.webm', 'audio/webm;codecs=opus', 1024, head, 'chat', 6000).extension,
    ).toBe('webm');
    expect(() => validateMedia('voice.webm', 'audio/webm', 1024, head, 'chat', 120001)).toThrow(
      'invalid_audio',
    );
    expect(() => validateMedia('voice.webm', 'audio/webm', 1024, head, 'memory', 1000)).toThrow(
      'invalid_audio',
    );
    expect(() => validateMedia('video.webm', 'video/webm', 1024, head, 'letter')).toThrow(
      'unsupported_media',
    );
  });
});
