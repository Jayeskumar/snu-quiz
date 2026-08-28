/* ============================================================
   lock.js — decrypting the question banks in the browser
   ============================================================

   The banks ship as AES-GCM ciphertext (see tools/lock-banks.mjs).
   The key is derived from the teacher's passphrase, so the files are
   noise to anyone who fetches them directly.

   A wrong passphrase produces a wrong key, and AES-GCM refuses to
   decrypt rather than returning garbage — so a failed decrypt IS the
   check. There is no separate password hash to attack.
   ============================================================ */

export class BadPassphrase extends Error {
  constructor() {
    super('That passphrase does not match.');
    this.name = 'BadPassphrase';
  }
}

function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveKey(passphrase, kdf) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: unb64(kdf.salt),
      iterations: kdf.iterations,
      hash: kdf.hash,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

export async function decryptJSON(envelope, key) {
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(envelope.iv) }, key, unb64(envelope.ct)
    );
  } catch {
    throw new BadPassphrase();
  }
  return JSON.parse(new TextDecoder().decode(plain));
}
