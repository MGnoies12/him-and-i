'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { Check, X, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/dates';
import type { Workspace } from '@/types/models';
const LocaleContext = createContext({
  locale: 'fa' as Locale,
  timezone: 'UTC',
  t: (fa: string, en: string) => fa || en,
  setLocale: (_locale: Locale) => {},
});
const WorkspaceContext = createContext<Workspace>({
  configured: false,
  userId: null,
  profile: null,
  couple: null,
  members: [],
  conversationId: null,
});
const ToastContext = createContext<(message: string, kind?: 'success' | 'error') => void>(() => {});
export function Providers({
  children,
  locale: initialLocale,
  workspace,
}: {
  children: ReactNode;
  locale: Locale;
  workspace: Workspace;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );
  const [locale, updateLocale] = useState(initialLocale);
  const [toasts, setToasts] = useState<
    { id: number; message: string; kind: 'success' | 'error' }[]
  >([]);
  const router = useRouter();
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('him-and-i-session');
    channel.onmessage = (event) => {
      if (event.data === 'refresh-session') {
        client.clear();
        window.location.reload();
      }
    };
    return () => channel.close();
  }, [client]);

  const toast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((items) => items.filter((t) => t.id !== id)), 5500);
  }, []);
  function setLocale(next: Locale) {
    updateLocale(next);
    document.cookie = `hi-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'fa' ? 'rtl' : 'ltr';
    router.refresh();
  }
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <WorkspaceContext.Provider value={workspace}>
          <LocaleContext.Provider
            value={{
              locale,
              timezone: workspace.profile?.timezone || 'UTC',
              t: (fa, en) => (locale === 'fa' ? fa : en),
              setLocale,
            }}
          >
            <ToastContext.Provider value={toast}>
              {children}
              <div className="toast-stack" aria-live="polite" aria-atomic="false">
                {toasts.map((item) => (
                  <div key={item.id} className={`toast ${item.kind}`} role="status">
                    {item.kind === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    <span>{item.message}</span>
                    <button
                      className="icon-button"
                      onClick={() => setToasts((items) => items.filter((t) => t.id !== item.id))}
                      aria-label={locale === 'fa' ? 'بستن پیام' : 'Dismiss message'}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </ToastContext.Provider>
          </LocaleContext.Provider>
        </WorkspaceContext.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
export const useI18n = () => useContext(LocaleContext);
export const useWorkspace = () => useContext(WorkspaceContext);
export const useToast = () => useContext(ToastContext);
