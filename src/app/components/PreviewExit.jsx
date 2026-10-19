"use client";
import { useRouter } from 'next/navigation';

export default function PreviewExit() {
  const router = useRouter();
  return (
    <button
      className="ghost"
      onClick={async () => {
        await fetch('/api/preview/lock', { method: 'POST' });
        router.replace('/');
        router.refresh();
      }}
    >退出预览</button>
  );
}
