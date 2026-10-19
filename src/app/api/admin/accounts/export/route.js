import { getSessionUser } from '@/lib/session';
import { q } from '@/lib/db';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });

  const { rows: users } = await q(
    `SELECT username, display_name, role, is_active, password_hash, created_at
       FROM users ORDER BY created_at`
  );
  const { rows: codes } = await q(
    `SELECT code, label, is_active, use_count, created_at, last_used_at
       FROM access_codes ORDER BY created_at`
  );

  const payload = {
    format: 'familytree-accounts',
    version: 1,
    exportedAt: new Date().toISOString(),
    users: users.map((u) => ({
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active,
      passwordHash: u.password_hash,
      createdAt: u.created_at,
    })),
    accessCodes: codes.map((c) => ({
      code: c.code,
      label: c.label,
      isActive: c.is_active,
      useCount: c.use_count,
      createdAt: c.created_at,
      lastUsedAt: c.last_used_at,
    })),
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  await q(
    "INSERT INTO audit_log (actor_id, action, entity, payload) VALUES ($1,'accounts.export','user',$2)",
    [user.id, JSON.stringify({ users: users.length, codes: codes.length })]
  ).catch(() => {});
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="familytree-accounts-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
