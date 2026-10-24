import sharp from 'sharp';
import { readdir, writeFile, mkdir } from 'node:fs/promises';
const icon = 'public/icons/icon.svg';
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(densities)) {
  for (const name of ['ic_launcher', 'ic_launcher_round'])
    await sharp(icon)
      .resize(size, size)
      .png()
      .toFile(`android/app/src/main/res/mipmap-${density}/${name}.png`);
  const canvasSize = Math.round(size * 2.25),
    markSize = Math.round(canvasSize * 0.57);
  const mark = await sharp(icon).resize(markSize, markSize).png().toBuffer();
  await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: '#FFF8F2' },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`);
}
const splashSvg = Buffer.from(
  `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="800" fill="#FFF8F2"/><path d="M400 435s-65-39-65-75a35 35 0 0 1 65-18 35 35 0 0 1 65 18c0 36-65 75-65 75Z" fill="none" stroke="#9E526E" stroke-width="5"/><path d="M332 478h136" stroke="#EBA9BC"/><circle cx="400" cy="510" r="3" fill="#C9829A"/></svg>`,
);
const res = 'android/app/src/main/res';
for (const dir of await readdir(res)) {
  if (!dir.startsWith('drawable')) continue;
  try {
    const path = `${res}/${dir}/splash.png`;
    const meta = await sharp(path).metadata();
    await sharp(splashSvg)
      .resize(meta.width, meta.height, { fit: 'contain', background: '#FFF8F2' })
      .png()
      .toBuffer()
      .then((buf) => writeFile(path, buf));
  } catch {
    /* Only existing generated splash variants are replaced. */
  }
}
await sharp(icon)
  .resize(1024, 1024)
  .flatten({ background: '#FFF8F2' })
  .png()
  .toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for (const suffix of ['', '-1', '-2'])
  await sharp(splashSvg)
    .resize(2732, 2732)
    .png()
    .toFile(`ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${suffix}.png`);
await mkdir('android/app/src/main/res/drawable', { recursive: true });
await writeFile(
  'android/app/src/main/res/drawable/ic_stat_heart.xml',
  `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M12,21C8,17 2,13 2,7a5,5 0,0 1,10 -2a5,5 0,0 1,10 2c0,6 -6,10 -10,14Z"/></vector>`,
);
console.log('Generated branded web/native icons and native splash variants.');
