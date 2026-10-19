import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { hashPassword } from '@/lib/password';

const ROLES = ['admin','user'];

async function requireOwner() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: '仅管理员可管理账号' }, { status: 403 }) };
  return { user };
}

export async function POST(req) {
  const { user, error } = await requireOwner();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').trim().toLowerCase();
  const displayName = String(body.displayName || '').trim() || username;
  const password = String(body.password || '');
  const role = String(body.role || 'user');

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: '用户名 3–32 位，只能用字母、数字、_ . -' }, { status: 422 });
  }
  if (displayName.length > 40) return NextResponse.json({ error: '显示名过长' }, { status: 422 });
  if (password.length < 8) return NextResponse.json({ error: '密码至少 8 位' }, { status: 422 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: '角色不合法' }, { status: 422 });

  const dup = await q('SELECT 1 FROM users WHERE username = $1', [username]);
  if (dup.rows[0]) return NextResponse.json({ error: '用户名已存在' }, { status: 409 });

  const hash = await hashPassword(password);
  const { rows } = await q(
    `INSERT INTO users (username, display_name, password_hash, role)
     VALUES ($1,$2,$3,$4) RETURNING id, username, display_name AS "displayName", role, is_active AS "isActive"`,
    [username, displayName, hash, role]
  );
  await q("INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES ($1,'user.create','user',$2)",
    [user.id, rows[0].id]);
  return NextResponse.json({ ok: true, user: rows[0] });
}
