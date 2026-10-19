"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NoticeForm({ notice }) {
  const router = useRouter();
  const [text, setText] = useState(notice || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setErr('');
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice: text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || '保存失败'); return; }
    setMsg(text.trim() ? '已保存' : '已清空公告');
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="form-head">
        <div>
          <h1>公告栏</h1>
          <p>只在输入访问码后的预览页顶部显示；未登录看不到，留空即隐藏</p>
        </div>
      </div>

      <label className="field field-wide">
        <span>公告内容</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
          placeholder="例如：本族谱已更新至第五代，清明节后统一校对，请各房核对。" />
        <small>{text.length}/500 字 · 支持换行</small>
      </label>

      {err && <p className="error">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="form-actions">
        <button className="primary" disabled={busy}>{busy ? '保存中…' : '保存公告'}</button>
      </div>
    </form>
  );
}
