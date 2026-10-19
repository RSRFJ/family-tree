"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { brandMark } from '@/lib/brand';

export default function CodeGate({ family }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/preview/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || '访问码不正确'); return; }
    router.replace('/preview');
    router.refresh();
  }

  return (
    <main className="gate">
      <div className="gate-stage">
        <div className="gate-card">
          <div className={"gate-seal" + (brandMark(family).length > 1 ? " two" : "")}>{brandMark(family)}</div>
          <h1>{family.title || '族谱'}</h1>
          <p className="gate-sub">{family.description || '请输入家族访问码'}</p>

          <form onSubmit={submit} className="gate-form">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="请输入访问码"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-label="访问码"
              required
            />
            {error && <p className="gate-error">{error}</p>}
            <button className="gate-btn" disabled={busy}>{busy ? '验证中…' : '进入族谱'}</button>
          </form>

          <Link href="/admin/login" className="gate-admin-link">管理员入口 →</Link>

          <p className="gate-hint">访问码由家族管理员提供 · 仅限家族成员</p>
        </div>
        <p className="gate-foot">数据仅家族内部可见，请勿转发访问码</p>
      </div>
    </main>
  );
}
