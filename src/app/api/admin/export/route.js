import { getSessionUser } from '@/lib/session';
import { q } from '@/lib/db';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });

  const { rows: fam } = await q('SELECT surname, title, description, logo_text, notice FROM family ORDER BY created_at LIMIT 1');
  const family = fam[0] || {};

  const { rows: people } = await q(
    `SELECT id, legacy_id, display_name, gender, birth_year, death_year, birth_place, burial_place,
            notes, is_living, generation
       FROM person WHERE deleted_at IS NULL
      ORDER BY generation, created_at`
  );
  const keyOf = new Map(people.map((p) => [p.id, p.legacy_id || p.id]));

  const { rows: rels } = await q(
    `SELECT pc.parent_id, pc.child_id, pc.role
       FROM parent_child pc
       JOIN person a ON a.id = pc.parent_id AND a.deleted_at IS NULL
       JOIN person b ON b.id = pc.child_id AND b.deleted_at IS NULL`
  );

  const payload = {
    format: 'familytree-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    family: {
      surname: family.surname,
      title: family.title,
      description: family.description,
      logoText: family.logo_text,
      notice: family.notice,
    },
    people: people.map((p) => ({
      key: keyOf.get(p.id),
      name: p.display_name,
      gender: p.gender,
      birthYear: p.birth_year,
      deathYear: p.death_year,
      birthPlace: p.birth_place,
      burialPlace: p.burial_place,
      notes: p.notes,
      isLiving: p.is_living,
      generation: p.generation,
    })),
    relations: rels.map((r) => ({ parent: keyOf.get(r.parent_id), child: keyOf.get(r.child_id), role: r.role })),
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  await q(
    "INSERT INTO audit_log (actor_id, action, entity, payload) VALUES ($1,'data.export','family',$2)",
    [user.id, JSON.stringify({ people: people.length, relations: rels.length })]
  ).catch(() => {});
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="familytree-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
