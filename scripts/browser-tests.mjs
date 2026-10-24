// Sandbox fallback: Chromium and its small system-library pack come from npm, not a blocked CDN.
import chromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';
import { spawn } from 'node:child_process';
await inflate('node_modules/@sparticuz/chromium/bin/al2023.tar.br');
setupLambdaEnvironment('/tmp/al2023/lib');
const executablePath = await chromium.executablePath();
const args = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-zygote',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
const child = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CHROMIUM_EXECUTABLE_PATH: executablePath,
    CHROMIUM_ARGS: JSON.stringify(args),
  },
  shell: process.platform === 'win32',
});
child.on('exit', (code) => {
  process.exitCode = code || 0;
});
