import { notFound } from 'next/navigation';
import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily, getPeople, getRelations } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import { getPersonById, getFatherId } from '@/lib/people';
import PersonForm from '../../components/PersonForm';

export const dynamic = 'force-dynamic';

export default async function EditPersonPage({ params }) {
  const user = await requireAdmin();
  const { id } = await params;
  const person = await getPersonById(id);
  if (!person || person.deletedAt) notFound();

  const fatherId = await getFatherId(null, id);
  const [family, people, relations] = await Promise.all([getFamily(), getPeople(), getRelations()]);

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <PersonForm
          people={people}
          relations={relations}
          person={{ ...person, fatherId, version: person.version }}
        />
      </main>
      <footer className="foot wrap">编辑人物 · 版本 {person.version} · 改动写入审计日志</footer>
    </AdminShell>
  );
}
