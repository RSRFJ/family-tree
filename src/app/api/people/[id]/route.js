import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { normalizePerson } from '@/lib/validate';
import { getPersonById, getFatherId, recomputeGenerations, wouldCycle, writeAudit } from '@/lib/people';

export async function PATCH(req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!['admin','user'].includes(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { errors, value } = normalizePerson(body);
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 422 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query(
      `SELECT id, display_name, gender, birth_year, death_year, birth_place, burial_place, notes, version
         FROM person WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!cur[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const current = cur[0];

    if (body.version !== undefined && Number(body.version) !== current.version) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'conflict', message: '这条记录已被修改，请刷新后重试', current },
        { status: 409 }
      );
    }

    const hasFather = value.fatherId !== undefined;

    if (hasFather && value.fatherId) {
      if (await wouldCycle(client, id, value.fatherId)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ errors: { fatherId: '不能把后代设成父亲（会形成环）' } }, { status: 422 });
      }
      const { rows } = await client.query('SELECT id FROM person WHERE id = $1 AND deleted_at IS NULL', [value.fatherId]);
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json({ errors: { fatherId: '父亲不存在' } }, { status: 422 });
      }
    }

    const oldFather = await getFatherId(client, id);

    const upd = await client.query(
      `UPDATE person SET display_name=$1, gender=$2, birth_year=$3, death_year=$4,
              birth_place=$5, burial_place=$6, notes=$7,
              is_living=$8, version=version+1, updated_at=now()
        WHERE id=$9
        RETURNING version`,
      [value.name, value.gender, value.birthYear, value.deathYear,
       value.birthPlace, value.burialPlace, value.notes, !value.deathYear, id]
    );

    if (hasFather && oldFather !== value.fatherId) {
      await client.query(`DELETE FROM parent_child WHERE child_id = $1 AND role = 'father'`, [id]);
      if (value.fatherId) {
        await client.query(
          `INSERT INTO parent_child (parent_id, child_id, role) VALUES ($1,$2,'father')`,
          [value.fatherId, id]
        );
      }
    }

    await recomputeGenerations(client);
    await writeAudit(client, {
      actorId: user.id,
      action: 'person.update',
      entity: 'person',
      entityId: id,
      payload: { before: current, after: { ...value, fatherId: hasFather ? value.fatherId : oldFather } },
    });
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, version: upd.rows[0].version });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[people.update]', e.message);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!['admin','user'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;

  const { rows } = await pool.query(
    `UPDATE person SET deleted_at = now(), deleted_by = $1, version = version + 1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id, deleted_at, display_name`,
    [user.id, id]
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await pool.query(
    `INSERT INTO audit_log (actor_id, action, entity, entity_id, payload)
     VALUES ($1,'person.delete','person',$2,$3)`,
    [user.id, id, JSON.stringify({ name: rows[0].display_name, deleted_at: rows[0].deleted_at })]
  );

  return NextResponse.json({
    ok: true,
    id,
    deleted_at: rows[0].deleted_at,
    undo: { seconds: 10, expires_at: new Date(Date.now() + 10_000).toISOString() },
  });
}
