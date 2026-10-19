import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { q } from './db';

const COOKIE = 'ft_preview';
const hash = (t) => createHash('sha256').update(t).digest('hex');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(len = 8) {
  let out = '';
  const buf = randomBytes(len);
  for (let i = 0; i < len; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

/** 校验访问码；命中则记录使用次数并返回该码 */
export async function verifyCode(input) {
  const code = String(input || '').trim().toUpperCase();
  if (!code) return null;
  const { rows } = await q('SELECT id, code, label FROM access_codes WHERE is_active = true');
  for (const row of rows) {
    const a = Buffer.from(code);
    const b = Buffer.from(String(row.code).toUpperCase());
    if (a.length === b.length && timingSafeEqual(a, b)) {
      await q('UPDATE access_codes SET last_used_at = now(), use_count = use_count + 1 WHERE id = $1', [row.id]);
      return row;
    }
  }
  return null;
}

/** 会话级 Cookie（关闭浏览器即失效），服务端最长 12 小时 */
export async function openPreview() {
  const token = randomBytes(24).toString('hex');
  await q(
    `INSERT INTO preview_sessions (token_hash, expires_at)
     VALUES ($1, now() + interval '12 hours')`,
    [hash(token)]
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
  });
}

export async function hasPreview() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const { rows } = await q(
    'SELECT 1 FROM preview_sessions WHERE token_hash = $1 AND expires_at > now()',
    [hash(token)]
  );
  return Boolean(rows[0]);
}

export async function lockPreview() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('DELETE FROM preview_sessions WHERE token_hash = $1', [hash(token)]);
  jar.delete(COOKIE);
}

export async function clearAllPreviewSessions() {
  await q('DELETE FROM preview_sessions');
}
