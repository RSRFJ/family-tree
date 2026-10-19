"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brandMark } from '@/lib/brand';

export default function SettingsForm({ family }) {
  const router = useRouter();
  const [title, setTitle] = useState(family.title || '');
  const [description, setDescription] = useState(family.description || '');
  const [logoText, setLogoText] = useState(family.logo_text || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = brandMark({ title, logo_text: logoText });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setErr('');
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, logoText }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || '保存失败'); return; }
    setMsg('已保存');
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="form-head">
        <div>
          <h1>站点信息</h1>
          <p>标题、简介、印章会同时用于首页、页头与浏览器标题</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field field-wide">
          <span>标题</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
          <small>例如：阮氏族谱</small>
        </label>

        <label className="field">
          <span>印章 / Logo</span>
          <input value={logoText} onChange={(e) => setLogoText(e.target.value)} maxLength={2}
            placeholder="留空取标题首字" />
          <small>1–2 个字，留空自动用标题第一个字</small>
        </label>
        <div className="field">
          <span>效果</span>
          <div className="logo-preview">
            <span className={"gate-seal static" + (preview.length > 1 ? " two" : "")}>{preview}</span>
            <span className="muted">页头与首页共用</span>
          </div>
        </div>

        <label className="field field-wide">
          <span>简介</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200}
            placeholder="例如：记录阮家五代人的世系与生平" />
        </label>
      </div>

      {err && <p className="error">{err}</p>}
      {msg && (
        <p className="ok">已保存 ·
          <a className="inline-link" href="/" target="_blank" rel="noreferrer">打开首页查看</a>
          <span className="muted">（若首页仍旧，按 Ctrl+F5 强制刷新）</span>
        </p>
      )}

      <div className="form-actions">
        <button className="primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </form>
  );
}
