import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import {
  pairingAlphabet,
  pairingPattern,
  normalizePairingCode,
  formatPairingCode,
} from '@/lib/pairing';
export function hashPairingCode(input: string) {
  const code = normalizePairingCode(input);
  if (!pairingPattern.test(code)) throw new Error('invalid_invitation');
  return createHash('sha256')
    .update('him-and-i:pairing-code:' + code)
    .digest('hex');
}
export function generatePairingCode() {
  const raw = Array.from(randomBytes(12), (byte) => pairingAlphabet[byte & 31]).join('');
  return { code: formatPairingCode(raw), hash: hashPairingCode(raw) };
}
