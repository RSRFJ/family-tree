import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { recomputeGenerations, writeAudit } from '@/lib/people';
import { readJson, errorResponse } from '@/lib/http';

const GENDERS = new Set(['male', 'female', 'other', 'unknown']);

function num(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1000 && n <= 2100 ? n : null;
}

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try {
    body = await readJson(req, 8 * 1024 * 1024);
  } catch (e) {
    return errorResponse(e);
  }
  if (body.format !== 'familytree-backup' || body.version !== 1) {
    return NextResponse.json({ error: '不是族谱备份文件' }, { status: 422 });
  }
  if (body.confirm !== 'RESTORE') {
    return NextResponse.json({ error: '请输入 RESTORE 确认' }, { status: 400 });
  }
  const people = Array.isArray(body.people) ? body.people : [];
  const relations = Array.isArray(body.relations) ? body.relations : [];
  if (!people.length) return NextResponse.json({ error: '备份里没有人物数据' }, { status: 422 });
  if (people.length > 5000 || relations.length > 10000) {
    return NextResponse.json({ error: '备份数据量超出限制' }, { status: 422 });
  }

  const keys = new Set();
  for (const p of people) {
    const name = String(p.name || p.display_name || '').trim();
    if (!name) return NextResponse.json({ error: '存在没有姓名的人物' }, { status: 422 });
    if (name.length > 64) return NextResponse.json({ error: `姓名过长：${name}` }, { status: 422 });
    const key = String(p.key || p.legacy_id || '');
    if (!key || key.length > 64) return NextResponse.json({ error: `缺少或 key 过长：${name}` }, { status: 422 });
    if (keys.has(key)) return NextResponse.json({ error: `key 重复：${key}` }, { status: 422 });
    keys.add(key);
  }
  for (const r of relations) {
    if (!keys.has(String(r.parent)) || !keys.has(String(r.child))) {
      return NextResponse.json({ error: '存在指向不存在人物的关系' }, { status: 422 });
    }
    if (String(r.parent) === String(r.child)) {
      return NextResponse.json({ error: '存在自己指向自己的关系' }, { status: 422 });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fam = await client.query('SELECT id FROM family ORDER BY created_at LIMIT 1');
    const familyId = fam.rows[0]?.id;
    if (!familyId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: '站点未初始化' }, { status: 500 });
    }

    await client.query('DELETE FROM parent_child');
    await client.query('DELETE FROM person');

    const idByKey = new Map();
    for (const p of people) {
      const key = String(p.key || p.legacy_id);
      const ins = await client.query(
        `INSERT INTO person (family_id, legacy_id, display_name, gender, birth_year, death_year,
                             birth_place, burial_place, notes, is_living, generation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1) RETURNING id`,
        [familyId, key, String(p.name || p.display_name).trim(), GENDERS.has(p.gender) ? p.gender : 'unknown',
         num(p.birthYear), num(p.deathYear), String(p.birthPlace || '').slice(0, 120) || null,
         String(p.burialPlace || '').slice(0, 120) || null,
         String(p.notes || '').slice(0, 5000), p.isLiving !== false]
      );
      idByKey.set(key, ins.rows[0].id);
    }

    for (const r of relations) {
      await client.query(
        `INSERT INTO parent_child (parent_id, child_id, role) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [idByKey.get(String(r.parent)), idByKey.get(String(r.child)), r.role === 'mother' ? 'mother' : 'father']
      );
    }

    await recomputeGenerations(client);

    if (body.family && typeof body.family === 'object') {
      const f = body.family;
      await client.query(
        `UPDATE family SET title = COALESCE($1, title), description = $2, logo_text = $3, notice = $4
          WHERE id = $5`,
        [String(f.title || '').slice(0, 60) || null, String(f.description || '').slice(0, 200),
         String(f.logoText || '').slice(0, 2) || null, String(f.notice || '').slice(0, 500) || null, familyId]
      );
    }

    await writeAudit(client, {
      actorId: user.id, action: 'data.import', entity: 'family', entityId: familyId,
      payload: { people: people.length, relations: relations.length },
    });
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, people: people.length, relations: relations.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[data.import]', e.message);
    return NextResponse.json({ error: '导入失败，请检查备份文件' }, { status: 500 });
  } finally {
    client.release();
  }
}
