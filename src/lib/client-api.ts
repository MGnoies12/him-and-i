import type { ActionInput } from '@/schemas/actions';
export class ClientError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ClientError('offline', 0);
  }
  const body = await response.json().catch(() => ({ error: 'request_failed' }));
  if (!response.ok) throw new ClientError(body.error || 'request_failed', response.status);
  return body as T;
}
export async function performClientAction<T = unknown>(action: ActionInput): Promise<T> {
  return (
    await requestJSON<{ data: T }>('/api/actions', { method: 'POST', body: JSON.stringify(action) })
  ).data;
}
export function errorText(error: unknown, t: (fa: string, en: string) => string) {
  const code =
    error instanceof ClientError
      ? error.code
      : error instanceof Error
        ? error.message
        : 'request_failed';
  const messages: Record<string, [string, string]> = {
    configuration_required: [
      'برای استفاده، ابتدا اتصال امن Supabase را پیکربندی کنید.',
      'Connect Supabase before using this feature.',
    ],
    server_configuration_required: [
      'این قابلیت به پیکربندی امن سرور نیاز دارد. راهنمای راه‌اندازی را ببینید.',
      'This feature needs server configuration. See the setup guide.',
    ],
    unauthenticated: ['برای ادامه وارد حساب خود شوید.', 'Please sign in to continue.'],
    invalid_credentials: [
      'ایمیل یا رمز عبور درست نیست. دوباره بررسی کنید.',
      'The email or password is incorrect. Please try again.',
    ],
    email_not_confirmed: [
      'ابتدا ایمیل خود را از طریق پیوند تأیید، تأیید کنید.',
      'Please verify your email using the confirmation link.',
    ],
    signup_failed: [
      'ایجاد حساب ممکن نشد. ایمیل، رمز و تنظیمات سرویس را بررسی کنید.',
      'We could not create your account. Check your details and email configuration.',
    ],
    invalid_invitation: [
      'این دعوت معتبر نیست، منقضی شده یا قبلاً استفاده شده است.',
      'This invitation is invalid, expired, revoked, or already used.',
    ],
    already_member: [
      'شما از قبل عضو یک فضای دونفره هستید.',
      'You already belong to a couple space.',
    ],
    couple_full: ['این فضا از قبل دو عضو دارد.', 'This space already has two members.'],
    membership_required: [
      'ابتدا فضای دونفره‌تان را بسازید یا دعوت را بپذیرید.',
      'Create your space or accept your partner’s invitation first.',
    ],
    partner_required: [
      'ابتدا همراهتان را به این فضا دعوت کنید.',
      'Invite your partner before sending a letter.',
    ],
    rate_limited: ['کمی صبر کنید و دوباره تلاش کنید.', 'Please wait a little before trying again.'],
    offline: [
      'اتصال برقرار نیست. تغییر ذخیره نشد؛ دوباره تلاش کنید.',
      'You appear to be offline. Your change was not saved; please retry.',
    ],
    upload_failed: [
      'بارگذاری کامل نشد. دوباره تلاش کنید.',
      'The upload did not complete. Please try again.',
    ],
    file_too_large: [
      'هر فایل باید کمتر از ۴ مگابایت باشد.',
      'Each file must be no larger than 4 MB.',
    ],
    unsupported_media: [
      'نوع یا محتوای این فایل پشتیبانی نمی‌شود.',
      'This file type or its contents are not supported.',
    ],
    invalid_audio: [
      'ضبط باید بین یک لحظه تا دو دقیقه باشد.',
      'Recordings must be valid and no longer than two minutes.',
    ],
    validation_failed: ['لطفاً اطلاعات فرم را بررسی کنید.', 'Please check the form details.'],
    invalid_date: [
      'تاریخ‌ها و منطقه‌ی زمانی را بررسی کنید؛ سوابق نباید در آینده باشند و پایان باید با شروع سازگار باشد.',
      'Check the dates and timezone: records cannot be in the future, and the end must follow the start.',
    ],
    payload_too_large: ['حجم داده بیش از حد مجاز است.', 'The request is too large.'],
    letter_unavailable: [
      'این نامه هنوز قابل بازکردن نیست.',
      'This letter is not available to open yet.',
    ],
    already_exists: ['این مورد قبلاً ثبت شده است.', 'This has already been saved.'],
    permission_denied: [
      'اجازه داده نشد. می‌توانید از پیام متنی استفاده کنید.',
      'Permission was denied. You can send a text message instead.',
    ],
    unsupported_recording: [
      'ضبط صدا در این دستگاه در دسترس نیست. پیام متنی یا فایل صوتی بفرستید.',
      'Recording is unavailable here. Send text or choose an audio file instead.',
    ],
    unsupported_push_endpoint: [
      'سرویس اعلان این مرورگر هنوز پشتیبانی نمی‌شود.',
      'This browser’s push provider is not supported yet.',
    ],
    auth_callback: [
      'پیوند ورود معتبر نیست یا منقضی شده است. دوباره درخواست کنید.',
      'The authentication link is invalid or expired. Please request a new one.',
    ],
  };
  const pair = messages[code] || [
    'انجام نشد. اتصال و تنظیمات را بررسی کنید و دوباره تلاش کنید.',
    'That did not complete. Check your connection and configuration, then retry.',
  ];
  return t(...pair);
}
export function deviceId() {
  const current = document.cookie
    .split('; ')
    .find((v) => v.startsWith('hi-device='))
    ?.split('=')[1];
  if (current && /^[0-9a-f-]{36}$/.test(current)) return current;
  const id = crypto.randomUUID();
  document.cookie = `hi-device=${id}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`;
  return id;
}

export function broadcastSessionChange() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('him-and-i-session');
  channel.postMessage('refresh-session');
  channel.close();
}
