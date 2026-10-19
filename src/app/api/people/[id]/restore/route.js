import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(_req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;

  const { rows } = await q(
    `UPDATE person SET deleted_at = NULL, deleted_by = NULL, version = version + 1
      WHERE id = $1 AND deleted_at > now() - interval '30 days'
      RETURNING id, display_name`,
    [id]
  );

  if (!rows[0]) {
    const { rows: exists } = await q('SELECT deleted_at FROM person WHERE id = $1', [id]);
    if (!exists[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (!exists[0].deleted_at) return NextResponse.json({ restored: true, already: true });
    return NextResponse.json({ error: '超过回收站保留期' }, { status: 410 });
  }

  await q(
    `INSERT INTO audit_log (actor_id, action, entity, entity_id, payload)
     VALUES ($1,'person.restore','person',$2,$3)`,
    [user.id, id, JSON.stringify({ name: rows[0].display_name })]
  );
  return NextResponse.json({ restored: true, already: false });
}
