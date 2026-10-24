'use client';
import { Capacitor } from '@capacitor/core';
import { ClientError } from './client-api';
/** User-initiated only. Never adds health exports to the general account export. */
export async function downloadExport(scope: 'account' | 'cycle') {
  let response: Response;
  try {
    response = await fetch(`/api/export?scope=${scope}`, { cache: 'no-store' });
  } catch {
    throw new ClientError('offline');
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: 'request_failed' }));
    throw new ClientError(result.error || 'request_failed', response.status);
  }
  const name = `him-and-i-${scope === 'cycle' ? 'private-cycle' : 'account'}.json`;
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const path = `exports/${crypto.randomUUID()}-${name}`;
    const result = await Filesystem.writeFile({
      path,
      data: await response.text(),
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    try {
      await Share.share({
        title: 'HIM & I export',
        files: [result.uri],
        dialogTitle: 'Save your private export',
      });
    } finally {
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
    }
  } else {
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}
export async function purgeNativeExports() {
  if (!Capacitor.isNativePlatform()) return;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  // Also removes a temporary export left behind if the OS killed the app during sharing.
  await Filesystem.rmdir({ path: 'exports', directory: Directory.Cache, recursive: true }).catch(
    () => {},
  );
}
