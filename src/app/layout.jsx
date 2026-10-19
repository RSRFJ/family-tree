import './globals.css';
import { getFamily } from '@/lib/data';

export async function generateMetadata() {
  try {
    const family = await getFamily();
    return {
      title: family.title || '族谱',
      description: family.description || '',
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: '族谱', robots: { index: false, follow: false } };
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
