import { redirect } from 'next/navigation';
import { getFamily, getPeople, getRelations } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import { hasPreview } from '@/lib/preview';
import Notice from '@/app/components/Notice';
import Header from '../../components/Header';
import FamilyGraph from '../../components/FamilyGraph';

export const dynamic = 'force-dynamic';

export default async function PreviewTreePage({ searchParams }) {
  if (!(await hasPreview())) redirect('/');
  const sp = (await searchParams) || {};
  const initialView = sp.view === 'focus' ? 'focus' : sp.view === 'graph' ? 'graph' : null;
  const initialFocusId = typeof sp.focus === 'string' ? sp.focus : null;

  const [family, people, relations] = await Promise.all([getFamily(), getPeople(), getRelations()]);
  return (
    <>
      <Header title={family.title} surname={brandMark(family)} active="tree" />
      <main className="wrap">
        <Notice text={family.notice} />
        <FamilyGraph people={people} relations={relations} initialView={initialView}
          initialFocusId={initialFocusId} />
      </main>
      <footer className="foot wrap">共 {people.length} 人 · 点击人物查看父母与子女</footer>
    </>
  );
}
