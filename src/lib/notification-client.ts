'use client';
import { Capacitor } from '@capacitor/core';
import { ClientError, deviceId, performClientAction } from '@/lib/client-api';
export async function registerThisDevice() {
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') throw new ClientError('permission_denied');
    const listeners: (() => Promise<void>)[] = [];
    try {
      const token = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new ClientError('server_configuration_required')),
          15000,
        );
        void (async () => {
          const registration = await PushNotifications.addListener('registration', ({ value }) => {
            clearTimeout(timeout);
            resolve(value);
          });
          listeners.push(() => registration.remove());
          const failure = await PushNotifications.addListener('registrationError', () => {
            clearTimeout(timeout);
            reject(new ClientError('server_configuration_required'));
          });
          listeners.push(() => failure.remove());
          await PushNotifications.register();
        })().catch(() => {
          clearTimeout(timeout);
          reject(new ClientError('server_configuration_required'));
        });
      });
      const transport = Capacitor.getPlatform() === 'ios' ? 'apns' : 'fcm';
      await performClientAction({
        type: 'notifications.subscribe',
        device_id: deviceId(),
        transport,
        subscription: { token },
      });
      return 'native-awaiting-provider' as const;
    } finally {
      await Promise.all(listeners.map((remove) => remove()));
    }
  }
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window) ||
    !window.isSecureContext
  )
    throw new ClientError('unsupported_push_endpoint');
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new ClientError('server_configuration_required');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new ClientError('permission_denied');
  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const key = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }));
  await performClientAction({
    type: 'notifications.subscribe',
    device_id: deviceId(),
    transport: 'web',
    subscription: subscription.toJSON() as Record<string, unknown>,
  });
  return 'web' as const;
}
export async function revokeThisDevice() {
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.unregister().catch(() => {});
  } else if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }
}
