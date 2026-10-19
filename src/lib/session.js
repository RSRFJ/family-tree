import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { q } from './db';

const COOKIE = 'ft_admin';
const MAX_AGE = 60 * 60 * 24 * 7;

export const hashToken = (t) => createHash('sha256').update(t).digest('hex');

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await q(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '7 days')`,
    [hashToken(token), userId]
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await q(
    `SELECT u.id, u.username, u.display_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  jar.delete(COOKIE);
}
