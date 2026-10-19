import { randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(_scrypt);
const N = 32768, r = 8, p = 1, KEYLEN = 64;

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, { N, r, p, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
