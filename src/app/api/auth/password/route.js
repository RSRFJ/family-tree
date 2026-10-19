import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSessionUser, createSession } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = String(body.current || '');
  const next = String(body.next || '');

  if (next.length < 8) return NextResponse.json({ error: '新密码至少 8 位' }, { status: 422 });

  const { rows } = await q('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) {
    return NextResponse.json({ error: '当前密码不正确' }, { status: 401 });
  }

  const hash = await hashPassword(next);
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
  // 使其他设备上的会话失效，再给当前浏览器换一个新会话
  await q('DELETE FROM sessions WHERE user_id = $1', [user.id]);
  await createSession(user.id);
  await q("INSERT INTO audit_log (actor_id, action, entity) VALUES ($1,'auth.password','user')", [user.id]);

  return NextResponse.json({ ok: true });
}
