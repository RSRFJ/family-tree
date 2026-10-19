"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_LABEL = { admin: '管理员', user: '普通成员' };

export default function UserManager({ users, meId }) {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || '创建失败'); return; }
    setMsg(`已创建 ${data.user.username}`);
    setForm({ username: '', displayName: '', password: '', role: 'user' });
    router.refresh();
  }

  async function patch(u, body) {
    setErr('');
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || '操作失败'); return; }
    router.refresh();
  }

  async function rename(u) {
    const dn = prompt('新的显示名', u.displayName);
    if (!dn || dn.trim() === u.displayName) return;
    await patch(u, { displayName: dn.trim() });
  }

  async function remove(u) {
    if (u.username === 'admin') {
      alert('默认管理员账号不能删除，只能停用。');
      return;
    }
    if (!confirm(`删除账号 ${u.username}？该账号会话立即失效，审计日志保留。`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || '删除失败'); return; }
    router.refresh();
  }

  async function resetPw(u) {
    const pw = prompt(`为 ${u.username} 设置新密码（至少 8 位）`);
    if (!pw) return;
    await patch(u, { password: pw });
    alert('密码已重置，该账号所有设备已退出');
  }

  return (
    <div>
      <div className="form-head">
        <div>
          <h1>成员账号</h1>
          <p>管理员可管账号、访问码、备份、回收站与审计；普通成员只能查看与增删改人物</p>
        </div>
      </div>

      <table className="audit codes">
        <thead>
          <tr><th>用户名</th><th>显示名</th><th>角色</th><th>状态</th><th>最近登录</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.isActive ? '' : 'off'}>
              <td><code className="code">{u.username}</code>{u.id === meId && <span className="muted">（我）</span>}</td>
              <td>{u.displayName}</td>
              <td>
                <select className="mini-select" value={u.role} disabled={u.id === meId}
                  onChange={(e) => patch(u, { role: e.target.value })}>
                  <option value="admin">管理员</option>
                  <option value="user">普通成员</option>
                  <option value="user">普通成员</option>
                </select>
              </td>
              <td>{u.isActive ? '启用' : '已停用'}</td>
              <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString('zh-CN') : '—'}</td>
              <td className="row-actions">
                <button className="mini" onClick={() => rename(u)}>改名</button>
                <button className="mini" onClick={() => resetPw(u)}>重置密码</button>
                <button className="mini" disabled={u.id === meId}
                  onClick={() => patch(u, { isActive: !u.isActive })}>{u.isActive ? '停用' : '启用'}</button>
                <button className="mini danger" disabled={u.id === meId} onClick={() => remove(u)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="code-add" onSubmit={create}>
        <input value={form.username} onChange={(e) => set('username', e.target.value)}
          placeholder="用户名（字母数字）" maxLength={32} required />
        <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)}
          placeholder="显示名（如：二叔）" maxLength={40} />
        <input value={form.password} onChange={(e) => set('password', e.target.value)}
          placeholder="初始密码（≥8 位）" type="password" minLength={8} required />
        <select className="mini-select" value={form.role} onChange={(e) => set('role', e.target.value)}>
          <option value="user">普通成员</option>
          <option value="admin">管理员</option>
          <option value="user">普通成员</option>
        </select>
        <button className="primary" disabled={busy}>{busy ? '创建中…' : '新增账号'}</button>
      </form>

      {err && <p className="error">{err}</p>}
      {msg && <p className="ok">{msg}</p>}
    </div>
  );
}
