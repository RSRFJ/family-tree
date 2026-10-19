import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily, getPeople, getRelations } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import PeopleList from '../components/PeopleList';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireAdmin();
  const [family, people, relations] = await Promise.all([getFamily(), getPeople(), getRelations()]);
  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <PeopleList people={people} relations={relations} canEdit />
      </main>
      <footer className="foot wrap">共 {people.length} 人 · 所有修改记入审计日志</footer>
    </AdminShell>
  );
}
