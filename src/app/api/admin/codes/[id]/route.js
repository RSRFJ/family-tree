import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { clearAllPreviewSessions } from '@/lib/preview';

async function requireOwner() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: '仅管理员可管理访问码' }, { status: 403 }) };
  return { user };
}

export async function PATCH(req, { params }) {
  const { user, error } = await requireOwner();
  if (error) return error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: '参数错误' }, { status: 422 });
  }

  const { rows } = await q(
    'UPDATE access_codes SET is_active = $1 WHERE id = $2 RETURNING id, is_active',
    [body.is_active, id]
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!body.is_active) await clearAllPreviewSessions();
  await q("INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES ($1,'access.toggle','access_code',$2)",
    [user.id, id]);
  return NextResponse.json({ ok: true, item: rows[0] });
}

export async function DELETE(_req, { params }) {
  const { user, error } = await requireOwner();
  if (error) return error;
  const { id } = await params;

  const { rows: active } = await q('SELECT count(*)::int AS c FROM access_codes WHERE is_active = true');
  const { rows: target } = await q('SELECT is_active FROM access_codes WHERE id = $1', [id]);
  if (!target[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (target[0].is_active && active[0].c <= 1) {
    return NextResponse.json({ error: '至少保留一个可用访问码' }, { status: 400 });
  }

  await q('DELETE FROM access_codes WHERE id = $1', [id]);
  await clearAllPreviewSessions();
  await q("INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES ($1,'access.delete','access_code',$2)",
    [user.id, id]);
  return NextResponse.json({ ok: true });
}
