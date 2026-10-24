'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Heart, Eye, EyeOff, Mail, LockKeyhole, CheckCircle2 } from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import { PublicHeader } from '@/components/layout/app-shell';
import { Button, Field, SetupNotice, DirectionArrow } from '@/components/ui/primitives';
import { ClientError, errorText, requestJSON, broadcastSessionChange } from '@/lib/client-api';
export type AuthMode = 'login' | 'signup' | 'reset' | 'password';
const schema = z.object({ email: z.string(), password: z.string(), display_name: z.string() });
export function AuthScreen({
  mode,
  next,
  errorCode,
}: {
  mode: AuthMode;
  next?: string;
  errorCode?: string;
}) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(errorCode ? errorText(new ClientError(errorCode), t) : '');
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', display_name: '' },
  });
  const headings = {
    login: t('خوش برگشتی،', 'Welcome back,'),
    signup: t('قصه‌ی ما، از اینجا.', 'Our story starts here.'),
    reset: t('یک شروع دوباره.', 'A fresh start.'),
    password: t('یک کلید تازه.', 'A new little key.'),
  };
  async function submit(values: z.infer<typeof schema>) {
    setError('');
    setMessage('');
    if (mode !== 'password' && !z.email().safeParse(values.email).success) {
      form.setError('email', { message: t('یک ایمیل معتبر وارد کنید.', 'Enter a valid email.') });
      return;
    }
    if ((mode === 'signup' || mode === 'password') && values.password.length < 12) {
      form.setError('password', {
        message: t('حداقل ۱۲ کاراکتر انتخاب کنید.', 'Choose at least 12 characters.'),
      });
      return;
    }
    if (mode === 'signup' && !values.display_name.trim()) {
      form.setError('display_name', { message: t('نامتان را وارد کنید.', 'Enter your name.') });
      return;
    }
    try {
      const result = await requestJSON<{ redirect?: string; message?: string }>('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ type: mode, ...values, next }),
      });
      if (result.redirect) {
        broadcastSessionChange();
        window.location.replace(result.redirect);
      } else
        setMessage(
          result.message === 'reset_email'
            ? t(
                'اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی برایتان فرستاده می‌شود.',
                'If an account exists for this email, a reset link will be sent.',
              )
            : t(
                'ایمیلتان را بررسی کنید و از پیوند تأیید وارد شوید.',
                'Check your inbox and follow the confirmation link.',
              ),
        );
    } catch (error) {
      setError(errorText(error, t));
    }
  }
  return (
    <div className="auth-page">
      <PublicHeader />
      <main className="auth-layout">
        <section className="auth-art">
          <img src="/images/together.jpg" alt="" />
          <div className="auth-art-overlay">
            <Heart size={27} strokeWidth={1.2} />
            <blockquote>
              {t(
                'خانه، همیشه یک جا نیست. گاهی یک نفر است.',
                'Home isn’t always a place. Sometimes, it’s a person.',
              )}
            </blockquote>
            <span dir="ltr">a little world, just for us.</span>
          </div>
        </section>
        <section className="auth-form-panel">
          <div className="eyebrow" dir="ltr">
            HIM & I · JUST THE TWO OF YOU
          </div>
          <h1>
            {headings[mode]}
            {mode === 'login' && (
              <>
                <br />
                <span className="romantic-accent">
                  {t('به دنیای خودمان.', 'to our little world.')}
                </span>
              </>
            )}
          </h1>
          <p className="auth-description">
            {mode === 'signup'
              ? t(
                  'اول حساب خودت را بساز؛ بعد، همراهت را دعوت کن.',
                  'Make your own account, then invite your person.',
                )
              : mode === 'reset'
                ? t(
                    'ایمیل حسابت را وارد کن تا پیوند بازیابی را بفرستیم.',
                    'Enter your email and we’ll send you a reset link.',
                  )
                : mode === 'password'
                  ? t('رمزی طولانی و منحصربه‌فرد انتخاب کن.', 'Choose a long, unique password.')
                  : t(
                      'خاطره‌ها و حرف‌های دونفره‌تان منتظرتان هستند.',
                      'Your memories and little conversations are waiting.',
                    )}
          </p>
          <SetupNotice compact />
          {message ? (
            <div className="auth-success" role="status">
              <CheckCircle2 size={32} />
              <p>{message}</p>
              <Link href="/login" className="text-link">
                {t('بازگشت به ورود', 'Back to sign in')}
                <DirectionArrow />
              </Link>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(submit)} className="form-stack" noValidate>
              {mode === 'signup' && (
                <Field
                  label={t('نام شما', 'Your name')}
                  error={form.formState.errors.display_name?.message}
                >
                  <input
                    autoComplete="given-name"
                    {...form.register('display_name')}
                    maxLength={60}
                    placeholder={t('دوست داری چه صدایت کنیم؟', 'What should we call you?')}
                    disabled={!ws.configured}
                  />
                </Field>
              )}
              {mode !== 'password' && (
                <Field
                  label={t('ایمیل', 'Email address')}
                  error={form.formState.errors.email?.message}
                >
                  <span className="input-icon">
                    <Mail size={17} />
                    <input
                      dir="ltr"
                      type="email"
                      autoComplete="email"
                      {...form.register('email')}
                      placeholder="you@example.com"
                      disabled={!ws.configured}
                    />
                  </span>
                </Field>
              )}
              {mode !== 'reset' && (
                <Field
                  label={t('رمز عبور', 'Password')}
                  error={form.formState.errors.password?.message}
                  hint={
                    mode !== 'login'
                      ? t(
                          'حداقل ۱۲ کاراکتر؛ یک عبارت منحصربه‌فرد بهتر است.',
                          'At least 12 characters; a unique passphrase is best.',
                        )
                      : undefined
                  }
                >
                  <span className="input-icon">
                    <LockKeyhole size={17} />
                    <input
                      dir="ltr"
                      type={show ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      {...form.register('password')}
                      maxLength={128}
                      placeholder="••••••••••••"
                      disabled={!ws.configured}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShow(!show)}
                      aria-label={
                        show
                          ? t('پنهان‌کردن رمز', 'Hide password')
                          : t('نمایش رمز', 'Show password')
                      }
                    >
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </Field>
              )}
              {mode === 'login' && (
                <Link href="/reset-password" className="text-link forgot">
                  {t('رمزت را فراموش کرده‌ای؟', 'Forgot your password?')}
                </Link>
              )}
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                busy={form.formState.isSubmitting}
                disabled={!ws.configured}
                className="full-width"
              >
                {mode === 'login'
                  ? t('ورود به خانه‌ی ما', 'Come on in')
                  : mode === 'signup'
                    ? t('ساخت حساب من', 'Create my account')
                    : mode === 'reset'
                      ? t('ارسال پیوند بازیابی', 'Send reset link')
                      : t('ذخیره‌ی رمز جدید', 'Save new password')}
                <DirectionArrow />
              </Button>
            </form>
          )}
          <p className="auth-switch">
            {mode === 'login'
              ? t('هنوز قصه‌مان را شروع نکرده‌ایم؟', 'Our story hasn’t started yet?')
              : t('از قبل حساب داری؟', 'Already have an account?')}{' '}
            <Link
              href={`${mode === 'login' ? '/signup' : '/login'}${next ? '?next=' + encodeURIComponent(next) : ''}`}
            >
              {mode === 'login' ? t('ساخت حساب', 'Create an account') : t('ورود', 'Sign in')}
            </Link>
          </p>
          <div className="auth-privacy">
            <LockKeyhole size={13} />
            <span>
              {t(
                'با ادامه، سیاست حریم خصوصی را مطالعه کرده‌اید.',
                'By continuing, you acknowledge our privacy policy.',
              )}
            </span>
            <Link href="/privacy">{t('مطالعه', 'Read')}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
