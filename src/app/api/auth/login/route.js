import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { verifyPassword, DUMMY_HASH } from '@/lib/password';
import { createSession } from '@/lib/session';
import { readJson, errorResponse, clientIp } from '@/lib/http';
import { take, reset } from '@/lib/rate-limit';

const IP_WINDOW = 10 * 60 * 1000;
const IP_MAX = process.env.TRUST_PROXY === '1' ? 20 : 60;
const USER_WINDOW = 15 * 60 * 1000;
const USER_MAX = 10;

function tooMany(retryAfterMs) {
  return NextResponse.json(
    { error: '尝试过于频繁，请稍后再试' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  );
}

export async function POST(req) {
  const ipLimit = take(`login:ip:${clientIp(req)}`, IP_MAX, IP_WINDOW);
  if (ipLimit.limited) return tooMany(ipLimit.retryAfterMs);

  let body;
  try {
    body = await readJson(req, 4096);
  } catch (e) {
    return errorResponse(e);
  }

  const username = String(body.username || '').trim().slice(0, 64);
  const password = String(body.password || '').slice(0, 1024);
  if (!username || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }

  const userKey = `login:user:${username.toLowerCase()}`;
  const userLimit = take(userKey, USER_MAX, USER_WINDOW);
  if (userLimit.limited) return tooMany(userLimit.retryAfterMs);

  const { rows } = await q(
    'SELECT id, password_hash, is_active FROM users WHERE username = $1',
    [username]
  );
  const row = rows[0];
  // 未知用户也执行一次同参数 scrypt，避免通过响应时间枚举用户名。
  const ok = await verifyPassword(password, row?.password_hash || DUMMY_HASH);

  if (!row || !ok || !row.is_active) {
    await q(
      "INSERT INTO audit_log (actor_id, action, entity, payload) VALUES (NULL,'auth.login_failed','user',$1)",
      [JSON.stringify({ username })]
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
    return NextResponse.json({ error: '用户名或密码不正确' }, { status: 401 });
  }

  reset(userKey);
  await createSession(row.id);
  await q(
    "INSERT INTO audit_log (actor_id, action, entity) VALUES ($1,'auth.login','user')",
    [row.id]
  );
  return NextResponse.json({ ok: true });
}
