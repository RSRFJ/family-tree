import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily, getPeople, getRelations } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import FamilyGraph from '../../components/FamilyGraph';

export const dynamic = 'force-dynamic';

export default async function AdminTreePage({ searchParams }) {
  const user = await requireAdmin();
  const sp = (await searchParams) || {};
  const initialView = sp.view === 'focus' ? 'focus' : sp.view === 'graph' ? 'graph' : null;
  const initialFocusId = typeof sp.focus === 'string' ? sp.focus : null;

  const [family, people, relations] = await Promise.all([getFamily(), getPeople(), getRelations()]);
  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <FamilyGraph
          people={people}
          relations={relations}
          initialView={initialView}
          initialFocusId={initialFocusId}
          mode="admin"
        />
      </main>
      <footer className="foot wrap">共 {people.length} 人 · 管理视图</footer>
    </AdminShell>
  );
}
