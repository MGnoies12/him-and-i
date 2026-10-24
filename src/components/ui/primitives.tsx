'use client';
import {
  useEffect,
  useRef,
  useId,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import {
  X,
  Heart,
  LoaderCircle,
  ShieldCheck,
  CircleAlert,
  ArrowLeft,
  ArrowRight,
  Plus,
  Check,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useI18n, useWorkspace } from '@/components/providers';
import { errorText } from '@/lib/client-api';
export function Button({
  children,
  className = '',
  variant = 'primary',
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
      aria-busy={busy}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function LinkButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  return (
    <Link href={href} className={`button ${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function DirectionArrow({ size = 17 }: { size?: number }) {
  const { locale } = useI18n();
  return locale === 'fa' ? <ArrowLeft size={size} /> : <ArrowRight size={size} />;
}
export function Field({
  label,
  children,
  hint,
  error,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('بستن', 'Close')}>
            <X size={20} />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
export function EmptyState({
  icon: Icon = Heart,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: typeof Heart;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <div className="empty-icon">
        <Icon size={compact ? 24 : 30} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow" dir="ltr">
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SetupNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  if (ws.configured) return null;
  return (
    <aside className={`setup-notice ${compact ? 'compact' : ''}`} role="note">
      <ShieldCheck size={20} />
      <div>
        <strong>
          {t('فضای شما، در انتظار اتصال امن', 'Your space is waiting for a secure connection')}
        </strong>
        {!compact && (
          <p>
            {t(
              'این نمای راه‌اندازی است؛ هیچ اطلاعات شخصی یا فعالیت ساختگی نمایش داده نمی‌شود. برای ذخیره و اشتراک‌گذاری، Supabase را مطابق README متصل کنید.',
              'This is setup mode, not a simulated account. Connect Supabase using the README to save and share real content.',
            )}
          </p>
        )}
      </div>
      <span className="badge">{t('راه‌اندازی', 'Setup mode')}</span>
    </aside>
  );
}
export function MembershipNotice() {
  const ws = useWorkspace();
  const { t } = useI18n();
  if (!ws.configured || ws.couple) return null;
  return (
    <div className="notice">
      <Heart size={20} />
      <p>
        {t(
          'برای شروع، فضای دونفره‌تان را بسازید یا دعوت همراهتان را بپذیرید.',
          'Create your couple space or accept your partner’s invitation to get started.',
        )}
      </p>
      <LinkButton href="/home" variant="secondary">
        {t('شروع کنیم', 'Let’s begin')}
      </LinkButton>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="error-state" role="alert">
      <CircleAlert size={24} />
      <p>{errorText(error, t)}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          {t('تلاش دوباره', 'Try again')}
        </Button>
      )}
    </div>
  );
}
export function LoadingState() {
  const { t } = useI18n();
  return (
    <div
      className="loading-state"
      role="status"
      aria-label={t('در حال دریافت اطلاعات', 'Loading your space')}
    >
      <div className="skeleton title" />
      <div className="skeleton-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton card" />
        ))}
      </div>
    </div>
  );
}
export function ConfirmButton({
  onConfirm,
  children,
  title,
  description,
  disabled = false,
  className = '',
  variant = 'danger',
}: {
  onConfirm: () => Promise<void> | void;
  children: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  className?: string;
  variant?: 'danger' | 'ghost' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <Button
        variant={variant}
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
        <span className="sr-only">{title}</span>
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={title}>
        <p className="muted leading">{description}</p>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            {t('انصراف', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('تأیید', 'Confirm')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {href && (
        <Link href={href} className="text-link">
          {linkLabel || t('دیدن همه', 'View all')}
          <DirectionArrow size={15} />
        </Link>
      )}
    </div>
  );
}
export function Badge({ children, green = false }: { children: ReactNode; green?: boolean }) {
  return <span className={`badge ${green ? 'green' : ''}`}>{children}</span>;
}
export function AddIcon() {
  return <Plus size={17} />;
}
export function Saved() {
  const { t } = useI18n();
  return (
    <span className="saved">
      <Check size={15} />
      {t('ذخیره شد', 'Saved')}
    </span>
  );
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-wrap">
      <select {...props}>{children}</select>
      <ChevronDown size={16} />
    </span>
  );
}
