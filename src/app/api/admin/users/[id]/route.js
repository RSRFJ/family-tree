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

async function activeOwners() {
  const { rows } = await q("SELECT count(*)::int AS c FROM users WHERE role = 'admin' AND is_active = true");
  return rows[0].c;
}

export async function PATCH(req, { params }) {
  const { user, error } = await requireOwner();
  if (error) return error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { rows } = await q('SELECT id, username, display_name, role, is_active FROM users WHERE id = $1', [id]);
  const target = rows[0];
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const patch = {};
  if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
  if (typeof body.role === 'string') {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: '角色不合法' }, { status: 422 });
    patch.role = body.role;
  }
  if (typeof body.displayName === 'string') {
    const dn = body.displayName.trim();
    if (!dn || dn.length > 40) return NextResponse.json({ error: '显示名不合法' }, { status: 422 });
    patch.display_name = dn;
  }

  const disabling = patch.is_active === false;
  const demoting = patch.role && patch.role !== 'admin';
  if (id === user.id && disabling) {
    return NextResponse.json({ error: '不能停用自己的账号' }, { status: 400 });
  }
  if (target.role === 'admin' && target.is_active && (disabling || demoting)) {
    if ((await activeOwners()) <= 1) {
      return NextResponse.json({ error: '至少保留一个启用状态的管理员' }, { status: 400 });
    }
  }

  if (Object.keys(patch).length) {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) { sets.push(`${k} = $${i}`); vals.push(v); i += 1; }
    vals.push(id);
    await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  }

  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) return NextResponse.json({ error: '密码至少 8 位' }, { status: 422 });
    const hash = await hashPassword(body.password);
    await q('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    await q('DELETE FROM sessions WHERE user_id = $1', [id]);
    await q("INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES ($1,'user.password','user',$2)",
      [user.id, id]);
  }

  if (disabling) await q('DELETE FROM sessions WHERE user_id = $1', [id]);

  await q("INSERT INTO audit_log (actor_id, action, entity, entity_id, payload) VALUES ($1,'user.update','user',$2,$3)",
    [user.id, id, JSON.stringify({ role: patch.role, isActive: patch.is_active, displayName: patch.display_name })]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { user, error } = await requireOwner();
  if (error) return error;
  const { id } = await params;

  if (id === user.id) return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });

  const { rows } = await q('SELECT id, username, role, is_active FROM users WHERE id = $1', [id]);
  const target = rows[0];
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (target.username === 'admin') {
    return NextResponse.json({ error: '默认管理员账号不能删除，只能停用' }, { status: 400 });
  }
  if (target.role === 'admin' && target.is_active && (await activeOwners()) <= 1) {
    return NextResponse.json({ error: '至少保留一个启用状态的管理员' }, { status: 400 });
  }

  await q('DELETE FROM sessions WHERE user_id = $1', [id]);
  await q('DELETE FROM users WHERE id = $1', [id]);
  await q("INSERT INTO audit_log (actor_id, action, entity, entity_id, payload) VALUES ($1,'user.delete','user',$2,$3)",
    [user.id, id, JSON.stringify({ username: target.username })]);
  return NextResponse.json({ ok: true });
}
