import { genders, layouts } from '@/lib/personalization';
import { normalizePairingCode, pairingPattern } from '@/lib/pairing';
import { z } from 'zod';
import { safeExternalLink } from '@/lib/config';
const id = z.uuid();
const title = z.string().trim().min(1).max(120);
const date = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const optionalText = (max: number) => z.string().trim().max(max).default('');
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid timezone');
export const httpsUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2048)
    .refine((v) => !!safeExternalLink(v), 'Use an HTTPS link without credentials'),
]);
export const memoryFields = z.object({
  title,
  description: optionalText(10000),
  memory_date: date,
  location: optionalText(200),
  category: z.enum(['everyday', 'date', 'travel', 'milestone']),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  music_url: httpsUrl.default(''),
});
export const eventFields = z.object({
  title,
  description: optionalText(4000),
  starts_at: timestamp,
  ends_at: timestamp.nullable().default(null),
  timezone: timezoneSchema,
  all_day: z.boolean().default(false),
  location: optionalText(200),
  recurrence: z.enum(['FREQ=WEEKLY', 'FREQ=MONTHLY']).nullable().default(null),
  reminder_enabled: z.boolean().default(false),
  status: z.enum(['planned', 'done']).default('planned'),
});
export const periodFields = z.object({
  start_date: date,
  end_date: date.nullable().default(null),
  symptoms: z.array(z.string().trim().max(60)).max(12).default([]),
  notes: optionalText(4000),
});
const preferences = z.object({
  chat: z.boolean(),
  letters: z.boolean(),
  events: z.boolean(),
  memories: z.boolean(),
  cycle: z.boolean(),
  push_enabled: z.boolean(),
});
const simpleId = (type: string) => z.object({ type: z.literal(type), id });
export const profileSetupFields = z
  .object({
    display_name: z.string().trim().min(1).max(60),
    gender: z.enum(genders),
    layout: z.enum(layouts),
    locale: z.enum(['fa', 'en']),
    timezone: timezoneSchema,
    cycle_tracking: z.boolean(),
    period_start: z.iso.date().nullable(),
    reported_length: z.number().int().min(15).max(90).nullable(),
    irregular: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.period_start && !value.cycle_tracking)
      ctx.addIssue({
        code: 'custom',
        path: ['cycle_tracking'],
        message: 'Private cycle tracking consent is required to save a period date.',
      });
    if (value.reported_length !== null && !value.period_start)
      ctx.addIssue({ code: 'custom', path: ['period_start'], message: 'A start date is needed.' });
  });
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('couple.create'), relationship_start: date.nullable().default(null) }),
  z.object({ type: z.literal('couple.update'), relationship_start: date.nullable() }),
  z.object({ type: z.literal('invitation.create') }),
  z.object({ type: z.literal('invitation.code.create') }),
  z.object({
    type: z.literal('invitation.code.accept'),
    code: z.string().max(40).transform(normalizePairingCode).pipe(z.string().regex(pairingPattern)),
  }),
  z.object({ type: z.literal('profile.complete'), fields: profileSetupFields }),
  z.object({ type: z.literal('invitation.revoke'), id }),
  z.object({
    type: z.literal('invitation.accept'),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }),
  z.object({
    type: z.literal('memory.save'),
    id: id.optional(),
    fields: memoryFields,
    assets: z.array(id).max(8).default([]),
  }),
  z.object({ type: z.literal('memory.delete'), id }),
  z.object({ type: z.literal('memory.media.delete'), id }),
  z.object({ type: z.literal('memory.favorite'), id, active: z.boolean() }),
  z.object({
    type: z.literal('message.send'),
    id,
    body: optionalText(4000),
    asset_id: id.nullable().default(null),
    reply_to: id.nullable().default(null),
  }),
  z.object({ type: z.literal('message.delete'), id }),
  z.object({
    type: z.literal('message.react'),
    id,
    emoji: z.enum(['heart', 'smile', 'sparkles', 'hug']).nullable(),
  }),
  z.object({ type: z.literal('message.read') }),
  z.object({
    type: z.literal('letter.save'),
    id: id.optional(),
    title,
    body: z.string().trim().min(1).max(20000),
    occasion: optionalText(100),
    gift_message: optionalText(500),
    asset_id: id.nullable().default(null),
  }),
  z.object({ type: z.literal('letter.send'), id, release_at: timestamp }),
  z.object({ type: z.literal('letter.open'), id }),
  z.object({ type: z.literal('letter.cancel'), id }),
  z.object({ type: z.literal('letter.delete'), id }),
  z.object({ type: z.literal('event.save'), id: id.optional(), fields: eventFields }),
  z.object({ type: z.literal('event.delete'), id }),
  z.object({ type: z.literal('event.rsvp'), id, response: z.enum(['yes', 'maybe', 'no']) }),
  z.object({
    type: z.literal('mood.save'),
    mood: z.enum(['happy', 'calm', 'missing', 'tired', 'sad', 'stressed', 'space', 'support']),
    note: optionalText(2000),
    shared: z.boolean(),
    visible_hours: z.number().int().min(1).max(168),
  }),
  z.object({ type: z.literal('mood.delete'), id }),
  z.object({ type: z.literal('cycle.record.save'), id: id.optional(), fields: periodFields }),
  z.object({ type: z.literal('cycle.record.delete'), id }),
  z.object({
    type: z.literal('cycle.settings'),
    manual_length_confirmed: z.boolean().default(false),
    cycles_irregular: z.boolean().default(false),
    prediction_enabled: z.boolean(),
    cycle_length: z.number().int().min(15).max(90),
    period_length: z.number().int().min(1).max(15),
  }),
  z.object({
    type: z.literal('cycle.sharing'),
    share_status: z.boolean(),
    share_estimate: z.boolean(),
    status_text: optionalText(80),
    approximate_date: date.nullable(),
  }),
  z.object({
    type: z.literal('cycle.reminder.save'),
    id: id.optional(),
    kind: z.enum(['log', 'estimate', 'supplies']),
    enabled: z.boolean(),
    due_at: timestamp,
    timezone: timezoneSchema,
  }),
  z.object({ type: z.literal('cycle.reminder.delete'), id }),
  z.object({ type: z.literal('cycle.delete') }),
  z.object({ type: z.literal('playlist.create'), title }),
  z.object({ type: z.literal('playlist.delete'), id }),
  z.object({
    type: z.literal('track.add'),
    playlist_id: id,
    title,
    artist: title,
    url: z
      .url()
      .max(2048)
      .refine((v) => !!safeExternalLink(v)),
  }),
  z.object({ type: z.literal('track.delete'), id }),
  z.object({ type: z.literal('track.favorite'), id, active: z.boolean() }),
  z.object({ type: z.literal('game.start'), kind: z.enum(['know', 'choice', 'daily']) }),
  z.object({ type: z.literal('game.answer'), id, answer: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal('game.reveal'), id }),
  z.object({ type: z.literal('game.memory'), id }),
  z.object({ type: z.literal('notifications.preferences'), preferences }),
  z.object({ type: z.literal('notifications.read'), id: id.optional() }),
  z.object({
    type: z.literal('notifications.subscribe'),
    device_id: id,
    transport: z.enum(['web', 'fcm', 'apns']),
    subscription: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal('notifications.unsubscribe'), device_id: id.optional() }),
  z.object({
    type: z.literal('profile.save'),
    display_name: z.string().trim().min(1).max(60),
    locale: z.enum(['fa', 'en']),
    timezone: timezoneSchema,
  }),
]);
export type Action = z.infer<typeof actionSchema>;
export type ActionInput = z.input<typeof actionSchema>;
export const authSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('login'),
    email: z.email().max(254),
    password: z.string().min(1).max(128),
    next: z.string().optional(),
  }),
  z.object({
    type: z.literal('signup'),
    gender: z.enum(genders).default('unspecified'),
    email: z.email().max(254),
    password: z.string().min(12).max(128),
    display_name: z.string().trim().min(1).max(60),
    next: z.string().optional(),
  }),
  z.object({ type: z.literal('reset'), email: z.email().max(254) }),
  z.object({ type: z.literal('password'), password: z.string().min(12).max(128) }),
  z.object({
    type: z.literal('signout'),
    everywhere: z.boolean().default(false),
    device_id: id.optional(),
  }),
]);
export { simpleId };
