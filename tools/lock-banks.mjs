#!/usr/bin/env node
/* ============================================================
   lock-banks.mjs — encrypt and decrypt the question banks
   ============================================================

   The site is static, so anything shipped in plain text is readable by
   anyone who types the URL. These commands keep the answers unreadable
   without the teacher's passphrase.

     node tools/lock-banks.mjs lock   "your passphrase"
     node tools/lock-banks.mjs unlock "your passphrase"

   lock    reads the editable masters in data/src/, writes AES-GCM
           ciphertext to data/<key>.enc, and rewrites data/index.json.
           On the first run it moves the existing plaintext banks into
           data/src/ for you.

   unlock  does the reverse, restoring data/src/ so you can edit the
           questions. data/src/ is gitignored; only the .enc files and
           index.json are ever committed.

   index.json itself stays readable — it holds topic names and counts,
   not questions — so the home screen and the join flow still work for
   players, who never need the passphrase.
   ============================================================ */

import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const SRC = path.join(DATA, 'src');
const INDEX = path.join(DATA, 'index.json');

const ITERATIONS = 250000;
const HASH = 'SHA-256';

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: HASH },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJSON(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { v: 1, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

async function decryptJSON(envelope, key) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(envelope.iv) }, key, unb64(envelope.ct)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

const readJSON = async (p) => JSON.parse(await readFile(p, 'utf8'));
const writeJSON = (p, v) => writeFile(p, JSON.stringify(v, null, 1) + '\n');

/* ─────────── lock ─────────── */

async function lock(passphrase) {
  const index = await readJSON(INDEX);

  // First run: the banks are still sitting in data/ as plain JSON.
  if (!existsSync(SRC)) {
    await mkdir(SRC, { recursive: true });
    for (const meta of index.banks) {
      const from = path.join(DATA, meta.file);
      if (meta.file.endsWith('.enc')) continue;
      if (!existsSync(from)) throw new Error(`missing ${meta.file} — nothing to lock`);
      await rename(from, path.join(SRC, meta.key + '.json'));
    }
    console.log(`moved ${index.banks.length} plaintext banks into data/src/`);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt, ITERATIONS);

  const banks = [];
  for (const meta of index.banks) {
    const src = path.join(SRC, meta.key + '.json');
    if (!existsSync(src)) throw new Error(`missing data/src/${meta.key}.json`);
    const bank = await readJSON(src);

    await writeJSON(path.join(DATA, meta.key + '.enc'), await encryptJSON(bank, key));

    // Drop any plaintext copy left over from an earlier unlock.
    const stale = path.join(DATA, meta.key + '.json');
    if (existsSync(stale)) await rm(stale);

    banks.push({
      key: meta.key,
      label: meta.label,
      icon: meta.icon || '',
      file: meta.key + '.enc',
      count: (bank.questions || []).length,
    });
    console.log(`locked ${meta.key}  (${(bank.questions || []).length} questions)`);
  }

  await writeJSON(INDEX, {
    version: index.version || 1,
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: HASH, iterations: ITERATIONS, salt: b64(salt) },
    banks,
  });
  console.log(`\nwrote data/index.json — ${banks.length} banks locked`);
}

/* ─────────── unlock ─────────── */

async function unlock(passphrase) {
  const index = await readJSON(INDEX);
  if (!index.encrypted) throw new Error('data/index.json is not locked');

  const key = await deriveKey(passphrase, unb64(index.kdf.salt), index.kdf.iterations);
  await mkdir(SRC, { recursive: true });

  for (const meta of index.banks) {
    const envelope = await readJSON(path.join(DATA, meta.file));
    let bank;
    try {
      bank = await decryptJSON(envelope, key);
    } catch {
      throw new Error('that passphrase does not match');
    }
    await writeJSON(path.join(SRC, meta.key + '.json'), bank);
    console.log(`unlocked ${meta.key}  (${(bank.questions || []).length} questions)`);
  }
  console.log('\nmasters restored to data/src/ — edit there, then run lock again');
}

/* ─────────── cli ─────────── */

const [cmd, passphrase] = process.argv.slice(2);

if (!['lock', 'unlock'].includes(cmd) || !passphrase) {
  console.error('usage: node tools/lock-banks.mjs <lock|unlock> "passphrase"');
  process.exit(1);
}

try {
  await (cmd === 'lock' ? lock(passphrase) : unlock(passphrase));
} catch (err) {
  console.error('error: ' + err.message);
  process.exit(1);
}
