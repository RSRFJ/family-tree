import { q } from './db';

export async function getFamily() {
  const { rows } = await q('SELECT id, surname, title, description, logo_text, notice FROM family ORDER BY created_at LIMIT 1');
  return rows[0] || { id: null, surname: '氏', title: '族谱', description: '', logo_text: null, notice: '' };
}

export async function getPeople() {
  const { rows } = await q(
    `SELECT p.id, p.legacy_id, p.display_name AS name, p.gender, p.generation,
            p.birth_year AS "birthYear", p.death_year AS "deathYear", p.notes
       FROM person p
      WHERE p.deleted_at IS NULL
      ORDER BY p.generation NULLS LAST, p.birth_year NULLS LAST, p.display_name`
  );
  return rows;
}

export async function getRelations() {
  const { rows } = await q(
    `SELECT pc.parent_id AS parent, pc.child_id AS child, pc.role
       FROM parent_child pc
       JOIN person a ON a.id = pc.parent_id AND a.deleted_at IS NULL
       JOIN person b ON b.id = pc.child_id  AND b.deleted_at IS NULL`
  );
  return rows;
}

export function buildTree(people, relations) {
  const byId = new Map(people.map((p) => [p.id, { ...p, children: [] }]));
  const childIds = new Set();
  for (const r of relations) {
    const parent = byId.get(r.parent);
    const child = byId.get(r.child);
    if (parent && child) {
      parent.children.push(child);
      childIds.add(r.child);
    }
  }
  const roots = [...byId.values()].filter((p) => !childIds.has(p.id));
  return { roots, byId };
}

export async function getCounts() {
  const { rows } = await q(
    `SELECT (SELECT count(*)::int FROM person WHERE deleted_at IS NULL) AS people,
            (SELECT count(*)::int FROM parent_child) AS relations`
  );
  return rows[0];
}
