import type { CapacitorConfig } from '@capacitor/cli';
const remote = process.env.CAPACITOR_SERVER_URL;
if (remote && new URL(remote).protocol !== 'https:')
  throw new Error('CAPACITOR_SERVER_URL must be a trusted HTTPS origin.');
const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || 'io.github.mgnoies12.himandi',
  appName: 'HIM & I',
  webDir: 'native-web',
  // Bridge messages can carry device tokens or user-requested health export contents.
  loggingBehavior: 'none',
  server: remote
    ? {
        url: new URL('/home', remote).href,
        cleartext: false,
        errorPath: 'offline.html',
        allowNavigation: [new URL(remote).hostname],
      }
    : undefined,
  android: { allowMixedContent: false },
  ios: { contentInset: 'always', preferredContentMode: 'mobile' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#FFF8F2',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
    StatusBar: { style: 'LIGHT', backgroundColor: '#FFF8F2' },
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    LocalNotifications: { smallIcon: 'ic_stat_heart', iconColor: '#9E526E' },
  },
};
export default config;
