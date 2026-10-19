import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { hashPassword } from './password.mjs';
const { Pool } = pg;

const FILE = process.argv[2] || '/seed/family-data.json';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

function validate(data) {
  const people = [];
  data.generations.forEach((g, gi) => g.people.forEach(p => people.push({ ...p, generation: gi + 1 })));
  const ids = new Set();
  for (const p of people) {
    if (!p.id || !p.name) throw new Error(`person missing id/name: ${JSON.stringify(p)}`);
    if (ids.has(p.id)) throw new Error(`duplicate id: ${p.id}`);
    ids.add(p.id);
  }
  for (const p of people) {
    if (p.fatherId && !ids.has(p.fatherId)) throw new Error(`dangling fatherId: ${p.id} -> ${p.fatherId}`);
  }
  // 环检测
  const byId = new Map(people.map(p => [p.id, p]));
  for (const p of people) {
    const seen = new Set(); let cur = p;
    while (cur && cur.fatherId) {
      if (seen.has(cur.id)) throw new Error(`cycle at: ${p.id}`);
      seen.add(cur.id); cur = byId.get(cur.fatherId);
    }
  }
  return people;
}

async function main() {
  const client = await pool.connect();
  try {
    let familyId;
    const fam = await client.query('SELECT id FROM family ORDER BY created_at LIMIT 1');
    if (fam.rows[0]) familyId = fam.rows[0].id;
    else {
      const surname = process.env.FAMILY_SURNAME || '白';
      const ins = await client.query(
        'INSERT INTO family (surname, title) VALUES ($1,$2) RETURNING id',
        [surname, `${surname}氏族谱`]);
      familyId = ins.rows[0].id;
      console.log('[seed] created family', familyId);
    }

    // 管理员账号
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPw = process.env.ADMIN_PASSWORD;
    if (adminPw) {
      const exists = await client.query('SELECT 1 FROM users WHERE username=$1', [adminUser]);
      if (!exists.rows[0]) {
        await client.query(
          'INSERT INTO users (username, display_name, password_hash, role) VALUES ($1,$2,$3,$4)',
          [adminUser, adminUser, await hashPassword(adminPw), 'admin']);
        console.log(`[seed] created admin user "${adminUser}"`);
      }
    } else {
      console.log('[seed] WARN: ADMIN_PASSWORD not set, no login user created');
    }

    // 访问码：首次把环境变量里的默认码写入表
    const ac = await client.query('SELECT count(*)::int AS c FROM access_codes');
    if (ac.rows[0].c === 0 && process.env.PREVIEW_CODE) {
      await client.query('INSERT INTO access_codes (code, label) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',
        [process.env.PREVIEW_CODE.toUpperCase(), '默认访问码']);
      console.log('[seed] imported default access code');
    }

    const { rows: [{ count }] } = await client.query('SELECT count(*)::int AS count FROM person');
    if (count > 0) { console.log(`[seed] skip, ${count} people already exist`); return; }

    if (!existsSync(FILE)) { console.log(`[seed] no seed file at ${FILE}, skipped`); return; }
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    const people = validate(data);

    await client.query('BEGIN');
    for (const p of people) {
      await client.query(
        `INSERT INTO person (family_id, legacy_id, display_name, generation, birth_year, death_year, notes, is_living)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [familyId, p.id, p.name, p.generation,
         Number.isFinite(p.birthYear) ? p.birthYear : null,
         Number.isFinite(p.deathYear) ? p.deathYear : null,
         p.info || '', !p.deathYear]);
    }
    for (const p of people) {
      if (!p.fatherId) continue;
      await client.query(
        `INSERT INTO parent_child (parent_id, child_id, role)
         SELECT f.id, c.id, 'father' FROM person f, person c
         WHERE f.legacy_id=$1 AND c.legacy_id=$2`,
        [p.fatherId, p.id]);
    }
    await client.query('COMMIT');

    const { rows: [rel] } = await client.query('SELECT count(*)::int AS c FROM parent_child');
    const { rows: [reach] } = await client.query(`
      WITH RECURSIVE r AS (
        SELECT p.id FROM person p
        WHERE p.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM parent_child pc WHERE pc.child_id = p.id)
        UNION
        SELECT pc.child_id FROM parent_child pc JOIN r ON pc.parent_id = r.id
      ) SELECT count(*)::int AS c FROM r`);
    console.log(`[seed] imported people=${people.length} relations=${rel.c} reachable=${reach.c}`);
    if (reach.c !== people.length) throw new Error(`reachable mismatch: ${reach.c} != ${people.length}`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[seed] failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();
