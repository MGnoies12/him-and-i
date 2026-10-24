import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HIM & I',
    short_name: 'HIM & I',
    description: 'A private little world for two.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#FFF8F2',
    theme_color: '#FFF8F2',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
