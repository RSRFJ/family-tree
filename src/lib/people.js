import { q } from './db';

export async function getPersonById(id) {
  const { rows } = await q(
    `SELECT id, legacy_id, display_name AS name, gender, generation,
            birth_year AS "birthYear", death_year AS "deathYear",
            birth_place AS "birthPlace", burial_place AS "burialPlace",
            notes, version, deleted_at AS "deletedAt", created_at AS "createdAt"
       FROM person WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getFatherId(client, personId) {
  const runner = client || { query: q };
  const { rows } = await runner.query(
    `SELECT parent_id FROM parent_child WHERE child_id = $1 AND role = 'father' LIMIT 1`,
    [personId]
  );
  return rows[0]?.parent_id || null;
}

/** 全树重算世代：根为 1，子为父 + 1。放在写事务里调用。 */
export async function recomputeGenerations(client) {
  await client.query(`
    WITH RECURSIVE t AS (
      SELECT p.id, 1 AS gen
        FROM person p
       WHERE p.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM parent_child pc WHERE pc.child_id = p.id)
      UNION ALL
      SELECT pc.child_id, t.gen + 1
        FROM parent_child pc
        JOIN t ON pc.parent_id = t.id
    )
    UPDATE person p
       SET generation = t.gen
      FROM t
     WHERE p.id = t.id
       AND p.generation IS DISTINCT FROM t.gen
  `);
}

/** 判断把 fatherId 设为某父是否会成环（person 是否是 father 的祖先） */
export async function wouldCycle(client, personId, fatherId) {
  if (!fatherId) return false;
  if (personId === fatherId) return true;
  const { rows } = await client.query(
    `WITH RECURSIVE anc AS (
       SELECT parent_id FROM parent_child WHERE child_id = $1
       UNION
       SELECT pc.parent_id FROM parent_child pc JOIN anc a ON pc.child_id = a.parent_id
     )
     SELECT 1 FROM anc WHERE parent_id = $2 LIMIT 1`,
    [fatherId, personId]
  );
  return rows.length > 0;
}

export async function writeAudit(client, { actorId, action, entity, entityId, payload }) {
  await client.query(
    `INSERT INTO audit_log (actor_id, action, entity, entity_id, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [actorId, action, entity, entityId, payload ? JSON.stringify(payload) : null]
  );
}
