import { redirect } from 'next/navigation';
import { hasPreview } from '@/lib/preview';
import { getFamily } from '@/lib/data';
import CodeGate from './components/CodeGate';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  if (await hasPreview()) redirect('/preview');
  const family = await getFamily();
  return (
    <CodeGate
      family={{
        surname: family.surname,
        title: family.title,
        description: family.description,
        logo_text: family.logo_text,
      }}
    />
  );
}
