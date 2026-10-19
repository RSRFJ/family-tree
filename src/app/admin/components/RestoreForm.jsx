"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RestoreForm({ people, relations }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    setErr(''); setMsg(''); setSummary(null); setConfirm('');
    const f = e.target.files?.[0];
    setFile(f || null);
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.format !== 'familytree-backup') throw new Error('不是族谱备份文件');
      setSummary({
        people: Array.isArray(data.people) ? data.people.length : 0,
        relations: Array.isArray(data.relations) ? data.relations.length : 0,
        exportedAt: data.exportedAt ? new Date(data.exportedAt).toLocaleString('zh-CN') : '未知',
        raw: data,
      });
    } catch (e2) {
      setErr(e2.message || '文件解析失败');
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!summary) return;
    setBusy(true); setErr(''); setMsg('');
    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...summary.raw, confirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || '恢复失败'); return; }
    setMsg(`已恢复 ${data.people} 人、${data.relations} 条关系`);
    setSummary(null); setFile(null); setConfirm('');
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="form-head">
        <div>
          <h1>从备份恢复</h1>
          <p>覆盖现有 {people} 人、{relations} 条关系；回收站与旧数据会被清空，无法撤销</p>
        </div>
      </div>

      <label className="field field-wide">
        <span>选择备份文件</span>
        <input type="file" accept="application/json,.json" onChange={pick} />
      </label>

      {summary && (
        <div className="import-summary">
          <p>备份时间：{summary.exportedAt}</p>
          <p>包含：{summary.people} 人 · {summary.relations} 条关系</p>
        </div>
      )}

      {summary && (
        <label className="field">
          <span>输入 RESTORE 确认覆盖</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="RESTORE" />
        </label>
      )}

      {err && <p className="error">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="form-actions">
        <button className="primary danger-btn" disabled={!summary || confirm !== 'RESTORE' || busy}>
          {busy ? '恢复中…' : '覆盖并恢复'}
        </button>
      </div>
    </form>
  );
}
