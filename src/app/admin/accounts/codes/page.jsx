import { redirect } from 'next/navigation';
import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily } from '@/lib/data';
import { q } from '@/lib/db';
import { brandMark } from '@/lib/brand';
import AccessCodeManager from '../../components/AccessCodeManager';

export const dynamic = 'force-dynamic';

export default async function CodesPage() {
  const user = await requireAdmin();
  if (user.role !== 'admin') redirect('/admin/accounts');

  const family = await getFamily();
  const { rows: codes } = await q(
    `SELECT id, code, label, is_active AS "isActive", use_count AS "useCount",
            created_at AS "createdAt", last_used_at AS "lastUsedAt"
       FROM access_codes ORDER BY created_at`
  );

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <div className="form-card">
          <AccessCodeManager codes={codes} isOwner />
        </div>
      </main>
      <footer className="foot wrap">访问码 · 关闭或删除后对应预览会话立即失效</footer>
    </AdminShell>
  );
}
