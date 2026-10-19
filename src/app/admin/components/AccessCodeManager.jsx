"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccessCodeManager({ codes, isOwner }) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [created, setCreated] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  async function add(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setCreated('');
    const res = await fetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || '创建失败'); return; }
    setCreated(data.item.code);
    setLabel(''); setCode('');
    router.refresh();
  }

  async function toggle(item) {
    await fetch(`/api/admin/codes/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.isActive }),
    });
    router.refresh();
  }

  async function remove(item) {
    if (!confirm(`删除访问码 ${item.code}？使用该码的预览会话会立即失效。`)) return;
    const res = await fetch(`/api/admin/codes/${item.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || '删除失败'); return; }
    router.refresh();
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  }

  return (
    <div>
      <div className="form-head">
        <div>
          <h1>访问码</h1>
          <p>族人输入其中之一即可查看族谱；可以按支系或时期发不同的码，关闭/删除后对应会话立即失效</p>
        </div>
      </div>

      <table className="audit codes">
        <thead>
          <tr><th>访问码</th><th>备注</th><th>使用</th><th>最近使用</th><th>状态</th><th></th></tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.id} className={c.isActive ? '' : 'off'}>
              <td>
                <code className="code">{c.code}</code>
                <button className="mini" onClick={() => copy(c.code)}>{copied === c.code ? '已复制' : '复制'}</button>
              </td>
              <td>{c.label || '—'}</td>
              <td>{c.useCount} 次</td>
              <td>{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString('zh-CN') : '—'}</td>
              <td>{c.isActive ? '启用' : '已停用'}</td>
              <td className="row-actions">
                {isOwner && (
                  <>
                    <button className="mini" onClick={() => toggle(c)}>{c.isActive ? '停用' : '启用'}</button>
                    <button className="mini danger" onClick={() => remove(c)}>删除</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {codes.length === 0 && <tr><td colSpan={6} className="muted">还没有访问码</td></tr>}
        </tbody>
      </table>

      {isOwner ? (
        <form className="code-add" onSubmit={add}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="备注（例如：二房、2026 春节）" maxLength={40} />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="自定义（留空自动生成）" maxLength={32} />
          <button className="primary" disabled={busy}>{busy ? '创建中…' : '新增访问码'}</button>
        </form>
      ) : (
        <p className="muted">只有管理员可以新增或修改访问码</p>
      )}

      {err && <p className="error">{err}</p>}
      {created && (
        <p className="ok">新访问码：<code className="code">{created}</code>
          <button className="mini" onClick={() => copy(created)}>{copied === created ? '已复制' : '复制'}</button>
        </p>
      )}
    </div>
  );
}
