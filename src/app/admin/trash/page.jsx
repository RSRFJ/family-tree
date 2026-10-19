import { redirect } from 'next/navigation';
import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import { q } from '@/lib/db';
import TrashActions from '../components/TrashActions';

export const dynamic = 'force-dynamic';

export default async function TrashPage() {
  const user = await requireAdmin();
  if (user.role !== 'admin') redirect('/admin');
  const family = await getFamily();
  const { rows } = await q(
    `SELECT id, display_name AS name, deleted_at AS "deletedAt"
       FROM person WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC`
  );

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <div className="admin-bar">
          <span>删除后保留 30 天，可随时恢复</span>
          <a href="/admin" className="ghost">返回列表</a>
        </div>

        {rows.length === 0 ? (
          <p className="empty">回收站是空的</p>
        ) : (
          <ul className="trash-list">
            {rows.map((p) => (
              <li key={p.id}>
                <div>
                  <div className="trash-name">{p.name}</div>
                  <div className="trash-meta">删除于 {new Date(p.deletedAt).toLocaleString('zh-CN')}</div>
                </div>
                <TrashActions id={p.id} name={p.name} canPurge={user.role === 'admin'} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <footer className="foot wrap">共 {rows.length} 人 · 彻底删除仅管理员可操作</footer>
    </AdminShell>
  );
}
