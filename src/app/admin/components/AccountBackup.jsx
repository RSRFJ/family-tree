"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountBackup() {
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
      if (data.format !== 'familytree-accounts') throw new Error('不是账号备份文件');
      setSummary({ users: data.users?.length || 0, codes: data.accessCodes?.length || 0, raw: data });
    } catch (e2) {
      setErr(e2.message || '文件解析失败');
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!summary) return;
    setBusy(true); setErr(''); setMsg('');
    const res = await fetch('/api/admin/accounts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...summary.raw, confirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || '导入失败'); return; }
    setMsg(`已导入 ${data.users} 个账号、${data.codes} 个访问码；请重新登录`);
    setSummary(null); setFile(null); setConfirm('');
  }

  return (
    <div>
      <div className="form-head">
        <div>
          <h1>账号与访问码备份</h1>
          <p>单独导出/导入登录凭据（含密码哈希），用于迁移或灾难恢复</p>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 0 }}>
        <a className="primary link-btn" href="/api/admin/accounts/export">导出账号 JSON</a>
      </div>

      <label className="field field-wide" style={{ marginTop: 14 }}>
        <span>导入账号备份</span>
        <input type="file" accept="application/json,.json" onChange={pick} />
      </label>

      {summary && (
        <div className="import-summary">
          <p>包含：{summary.users} 个账号 · {summary.codes} 个访问码</p>
          <p className="muted">导入后所有设备需重新登录；不在备份中的账号不会被删除</p>
        </div>
      )}

      {summary && (
        <label className="field">
          <span>输入 RESTORE 确认</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="RESTORE" />
        </label>
      )}

      {err && <p className="error">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="form-actions">
        <button className="primary danger-btn" disabled={!summary || confirm !== 'RESTORE' || busy}
          onClick={submit}>{busy ? '导入中…' : '导入账号备份'}</button>
      </div>
    </div>
  );
}
