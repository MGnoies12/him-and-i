export const pairingAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const pairingPattern = /^[2-9A-HJ-NP-Z]{12}$/;
export function normalizePairingCode(value: string) {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[۰-۹٠-٩]/g, (character) =>
      String(character.charCodeAt(0) - (character.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)),
    );
}
export function formatPairingCode(value: string) {
  const normalized = normalizePairingCode(value);
  if (!pairingPattern.test(normalized)) throw new Error('invalid_invitation');
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8)}`;
}
