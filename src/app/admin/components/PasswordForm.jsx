"use client";
import { useState } from 'react';

export default function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setOk('');
    if (next !== again) { setError('两次输入的新密码不一致'); return; }
    if (next.length < 8) { setError('新密码至少 8 位'); return; }
    setBusy(true);
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || '修改失败'); return; }
    setOk('已更新，其他设备需重新登录');
    setCurrent(''); setNext(''); setAgain('');
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field"><span>当前密码</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </label>
      <label className="field"><span>新密码（至少 8 位）</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
      </label>
      <label className="field"><span>再输一次</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required autoComplete="new-password" />
      </label>
      {error && <p className="error">{error}</p>}
      {ok && <p className="ok">{ok}</p>}
      <button className="primary" disabled={busy}>{busy ? '保存中…' : '更新密码'}</button>
    </form>
  );
}
