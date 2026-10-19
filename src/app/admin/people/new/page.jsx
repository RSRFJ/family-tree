import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily, getPeople, getRelations } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import PersonForm from '../../components/PersonForm';

export const dynamic = 'force-dynamic';

export default async function NewPersonPage() {
  const user = await requireAdmin();
  const [family, people, relations] = await Promise.all([getFamily(), getPeople(), getRelations()]);
  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <PersonForm people={people} relations={relations} person={null} />
      </main>
      <footer className="foot wrap">新增人物 · 保存后自动重算世代</footer>
    </AdminShell>
  );
}
