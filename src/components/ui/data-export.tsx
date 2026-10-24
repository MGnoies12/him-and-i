'use client';
import { useState, type ReactNode } from 'react';
import { downloadExport } from '@/lib/data-export';
import { useI18n, useToast } from '@/components/providers';
import { errorText } from '@/lib/client-api';
export function ExportButton({
  scope,
  disabled,
  children,
  className,
}: {
  scope: 'account' | 'cycle';
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
  const toast = useToast();
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadExport(scope);
        } catch (error) {
          toast(errorText(error, t), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}
