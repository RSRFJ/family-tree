import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function DELETE(req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '仅管理员可彻底删除' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== 'DELETE') {
    return NextResponse.json({ error: '请输入 DELETE 确认' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `DELETE FROM person WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, display_name`,
    [id]
  );
  if (!rows[0]) return NextResponse.json({ error: '只能彻底删除回收站中的人物' }, { status: 400 });

  await pool.query(
    `INSERT INTO audit_log (actor_id, action, entity, entity_id, payload) VALUES ($1,'person.purge','person',$2,$3)`,
    [user.id, id, JSON.stringify({ name: rows[0].display_name })]
  );
  return NextResponse.json({ ok: true });
}
