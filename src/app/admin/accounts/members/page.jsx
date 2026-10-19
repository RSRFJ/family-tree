import { redirect } from 'next/navigation';
import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily } from '@/lib/data';
import { q } from '@/lib/db';
import { brandMark } from '@/lib/brand';
import UserManager from '../../components/UserManager';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const user = await requireAdmin();
  if (user.role !== 'admin') redirect('/admin/accounts');

  const family = await getFamily();
  const { rows: users } = await q(
    `SELECT u.id, u.username, u.display_name AS "displayName", u.role, u.is_active AS "isActive",
            u.created_at AS "createdAt",
            (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS "lastLogin"
       FROM users u ORDER BY u.created_at`
  );

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <div className="form-card">
          <UserManager users={users} meId={user.id} />
        </div>
      </main>
      <footer className="foot wrap">成员账号 · 停用或重置密码会立即退出该账号所有设备</footer>
    </AdminShell>
  );
}
