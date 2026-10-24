'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { safeRedirect } from '@/lib/config';
import { purgeNativeExports } from '@/lib/data-export';
export function NativeBridge() {
  const router = useRouter();
  const query = useQueryClient();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const cleanup: (() => Promise<void>)[] = [];
    let disposed = false;
    async function initialize() {
      const [{ App }, { Network }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/network'),
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
      ]);
      if (disposed) return;
      const routeLink = ({ url }: { url: string }) => {
        try {
          const target = new URL(url);
          const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || location.origin);
          const validWeb =
            target.origin === origin.origin && target.pathname.startsWith('/invite/');
          const validCustom = target.protocol === 'himandi:' && target.hostname === 'invite';
          if (validWeb || validCustom)
            router.push(
              safeRedirect(
                validCustom ? '/invite' + target.pathname : target.pathname + target.search,
              ),
            );
        } catch {
          /* Ignore untrusted deep links. */
        }
      };
      const link = await App.addListener('appUrlOpen', routeLink);
      cleanup.push(() => link.remove());
      const launch = await App.getLaunchUrl();
      if (launch && !disposed) routeLink(launch);
      await purgeNativeExports();
      const lifecycle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void query.invalidateQueries();
      });
      cleanup.push(() => lifecycle.remove());
      const network = await Network.addListener('networkStatusChange', ({ connected }) => {
        if (connected) void query.invalidateQueries();
      });
      cleanup.push(() => network.remove());
      await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      await SplashScreen.hide().catch(() => {});
      if (disposed) await Promise.all(cleanup.map((remove) => remove()));
    }
    void initialize().catch(() => {});
    return () => {
      disposed = true;
      cleanup.forEach((remove) => void remove());
    };
  }, [router, query]);
  return null;
}
