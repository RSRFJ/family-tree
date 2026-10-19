"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TrashActions({ id, name, canPurge }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [word, setWord] = useState('');

  async function restore() {
    setBusy(true);
    await fetch(`/api/people/${id}/restore`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  async function purge() {
    if (word !== 'DELETE') return;
    setBusy(true);
    const res = await fetch(`/api/people/${id}/purge`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    setBusy(false);
    if (res.ok) { setAsking(false); router.refresh(); }
    else alert('彻底删除失败');
  }

  return (
    <div className="trash-actions">
      <button className="sp-primary" onClick={restore} disabled={busy}>恢复</button>
      {canPurge && !asking && (
        <button className="ghost danger" onClick={() => setAsking(true)}>彻底删除</button>
      )}
      {asking && (
        <span className="purge-confirm">
          <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="输入 DELETE" aria-label="确认删除" />
          <button className="ghost danger" onClick={purge} disabled={word !== 'DELETE' || busy}>确认</button>
          <button className="ghost" onClick={() => { setAsking(false); setWord(''); }}>取消</button>
        </span>
      )}
    </div>
  );
}
