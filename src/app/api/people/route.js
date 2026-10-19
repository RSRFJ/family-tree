import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { normalizePerson } from '@/lib/validate';
import { recomputeGenerations, writeAudit } from '@/lib/people';

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!['admin','user'].includes(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { errors, value } = normalizePerson(body);
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 422 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (value.fatherId) {
      const { rows } = await client.query('SELECT id FROM person WHERE id = $1 AND deleted_at IS NULL', [value.fatherId]);
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json({ errors: { fatherId: '父亲不存在' } }, { status: 422 });
      }
    }

    const fam = await client.query('SELECT id FROM family ORDER BY created_at LIMIT 1');
    const familyId = fam.rows[0]?.id;
    if (!familyId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'family not initialized' }, { status: 500 });
    }

    const ins = await client.query(
      `INSERT INTO person (family_id, display_name, gender, birth_year, death_year,
                           birth_place, burial_place, notes, generation, is_living)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9)
       RETURNING id, version`,
      [familyId, value.name, value.gender, value.birthYear, value.deathYear,
       value.birthPlace, value.burialPlace, value.notes, !value.deathYear]
    );
    const id = ins.rows[0].id;

    if (value.fatherId) {
      await client.query(
        `INSERT INTO parent_child (parent_id, child_id, role) VALUES ($1,$2,'father')`,
        [value.fatherId, id]
      );
    }

    await recomputeGenerations(client);
    await writeAudit(client, { actorId: user.id, action: 'person.create', entity: 'person', entityId: id, payload: value });
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[people.create]', e.message);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  } finally {
    client.release();
  }
}
