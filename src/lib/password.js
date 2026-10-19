import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);
const N = 32768;
const r = 8;
const p = 1;
const KEYLEN = 64;

// 限制同时进行的 scrypt 数量，避免未认证请求把线程池/内存打满。
let active = 0;
const waiters = [];
async function withScryptSlot(fn) {
  if (active >= 2) await new Promise((resolve) => waiters.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}

// 未知用户名也跑一次同参数 scrypt，消除“用户是否存在”的时间差。
export const DUMMY_HASH = 'scrypt$32768$8$1$gvVfXLJJe2OVjAHJQXMohQ==$6mkRlHdaD99FmgonXTg3lmjRTkhHV2ZwTzH3cC13l+NFONwE1h6WCizKubfPtFhHkI53FUky34J6bC0pSXsVHQ==';

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await withScryptSlot(() =>
    scrypt(pw, salt, KEYLEN, { N, r, p, maxmem: 128 * 1024 * 1024 })
  );
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  try {
    const [alg, n, rr, pp, saltB64, hashB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    if (!expected.length) return false;
    const key = await withScryptSlot(() =>
      scrypt(pw, salt, expected.length, {
        N: Number(n), r: Number(rr), p: Number(pp), maxmem: 128 * 1024 * 1024,
      })
    );
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
