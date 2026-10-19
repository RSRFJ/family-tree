import { redirect } from 'next/navigation';
import { getFamily, getPeople, getRelations } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import { hasPreview } from '@/lib/preview';
import Notice from '@/app/components/Notice';
import Header from '../components/Header';
import PeopleList from '../components/PeopleList';

export const dynamic = 'force-dynamic';

export default async function PreviewPage() {
  if (!(await hasPreview())) redirect('/');
  const [family, people, relations] = await Promise.all([getFamily(), getPeople(), getRelations()]);
  return (
    <>
      <Header title={family.title} surname={brandMark(family)} active="list" />
      <main className="wrap">
        <Notice text={family.notice} />
        <PeopleList people={people} relations={relations} canEdit={false} />
      </main>
      <footer className="foot wrap">共 {people.length} 人 · 预览模式，仅供家族成员查看</footer>
    </>
  );
}
