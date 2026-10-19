import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { newCode } from '@/lib/preview';

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '仅管理员可管理访问码' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const label = String(body.label || '').trim().slice(0, 40) || null;
  let code = String(body.code || '').trim().toUpperCase();
  if (code && !/^[A-Z0-9]{7,32}$/.test(code)) {
    return NextResponse.json({ error: '访问码只能包含字母和数字，长度 7–32' }, { status: 422 });
  }
  if (!code) code = newCode(8);

  const exists = await q('SELECT 1 FROM access_codes WHERE code = $1', [code]);
  if (exists.rows[0]) return NextResponse.json({ error: '该访问码已存在' }, { status: 409 });

  const { rows } = await q(
    'INSERT INTO access_codes (code, label) VALUES ($1,$2) RETURNING id, code, label, is_active, created_at',
    [code, label]
  );
  await q("INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES ($1,'access.create','access_code',$2)",
    [user.id, rows[0].id]);
  return NextResponse.json({ ok: true, item: rows[0] });
}
