import { redirect } from 'next/navigation';
import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily } from '@/lib/data';
import SettingsForm from '../components/SettingsForm';
import NoticeForm from '../components/NoticeForm';
import { brandMark } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAdmin();
  if (user.role !== 'admin') redirect('/admin');
  const family = await getFamily();

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <div className="form-card">
          <SettingsForm family={family} />
        </div>
        <div className="form-card">
          <NoticeForm notice={family.notice || ''} />
        </div>
      </main>
      <footer className="foot wrap">站点设置 · 访问码与账号请到「账号与访问」</footer>
    </AdminShell>
  );
}
