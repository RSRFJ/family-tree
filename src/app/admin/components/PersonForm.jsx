"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const EMPTY = {
  name: '', gender: 'unknown', birthYear: '', deathYear: '',
  birthPlace: '', burialPlace: '', notes: '', fatherId: '',
};

function descendantsOf(id, relations) {
  const kids = new Map();
  for (const r of relations) {
    if (!kids.has(r.parent)) kids.set(r.parent, []);
    kids.get(r.parent).push(r.child);
  }
  const out = new Set();
  const stack = [...(kids.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop();
    if (out.has(cur)) continue;
    out.add(cur);
    stack.push(...(kids.get(cur) || []));
  }
  return out;
}

export default function PersonForm({ people, relations, person }) {
  const router = useRouter();
  const editing = Boolean(person);
  const [form, setForm] = useState(() =>
    person
      ? {
          name: person.name || '',
          gender: person.gender || 'unknown',
          birthYear: person.birthYear ?? '',
          deathYear: person.deathYear ?? '',
          birthPlace: person.birthPlace || '',
          burialPlace: person.burialPlace || '',
          notes: person.notes || '',
          fatherId: person.fatherId || '',
        }
      : EMPTY
  );
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    function warn(e) {
      if (!dirty || busy) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  const blocked = useMemo(
    () => (person ? descendantsOf(person.id, relations) : new Set()),
    [person, relations]
  );

  const fatherOptions = useMemo(
    () => people.filter((p) => p.id !== person?.id && !blocked.has(p.id)),
    [people, person, blocked]
  );

  const father = people.find((p) => p.id === form.fatherId);
  const generation = father ? (father.generation || 1) + 1 : 1;
  const descendantsCount = person ? blocked.size : 0;
  const fatherChanged = editing && (person.fatherId || '') !== form.fatherId;

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [key]: undefined }));
    setMessage('');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMessage('');
    const payload = { ...form, version: person?.version };
    const res = await fetch(editing ? `/api/people/${person.id}` : '/api/people', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.status === 409) {
      setMessage('这条记录刚被别人改过，请刷新页面后重新编辑');
      return;
    }
    if (res.status === 422) {
      setErrors(data.errors || {});
      if (!data.errors) setMessage(data.error || '请检查输入');
      return;
    }
    if (!res.ok) {
      setMessage(data.error || '保存失败');
      return;
    }
    setDirty(false);
    router.push('/admin');
    router.refresh();
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-head">
        <div>
          <h1>{editing ? '编辑人物' : '新增人物'}</h1>
          <p>{editing ? '修改后立即生效，并写入审计日志' : '保存后自动计算世代，可在树上看到'}</p>
        </div>
        <Link href="/admin" className="ghost">返回列表</Link>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>姓名 *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          {errors.name && <em>{errors.name}</em>}
        </label>

        <label className="field">
          <span>性别</span>
          <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="unknown">未记录</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </label>

        <label className="field">
          <span>父亲</span>
          <select value={form.fatherId} onChange={(e) => set('fatherId', e.target.value)}>
            <option value="">（无 / 始祖）</option>
            {fatherOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.generation ? `（第${p.generation}世）` : ''}
              </option>
            ))}
          </select>
          {errors.fatherId && <em>{errors.fatherId}</em>}
          <small>世代：第 {generation} 世（由父系推算）</small>
        </label>

        <label className="field">
          <span>生年</span>
          <input inputMode="numeric" value={form.birthYear} onChange={(e) => set('birthYear', e.target.value)} placeholder="1880" />
          {errors.birthYear && <em>{errors.birthYear}</em>}
        </label>

        <label className="field">
          <span>卒年</span>
          <input inputMode="numeric" value={form.deathYear} onChange={(e) => set('deathYear', e.target.value)} placeholder="1970（在世留空）" />
          {errors.deathYear && <em>{errors.deathYear}</em>}
        </label>

        <label className="field">
          <span>出生地</span>
          <input value={form.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} />
        </label>

        <label className="field">
          <span>安葬地</span>
          <input value={form.burialPlace} onChange={(e) => set('burialPlace', e.target.value)} />
        </label>

        <label className="field field-wide">
          <span>生平简介</span>
          <textarea rows={5} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>

      {fatherChanged && descendantsCount > 0 && (
        <p className="form-warn">
          变更父亲后，本人及 {descendantsCount} 位后代的世代会自动重算。
        </p>
      )}

      {message && <p className="error">{message}</p>}

      <div className="form-actions">
        <button className="primary" disabled={busy}>{busy ? '保存中…' : editing ? '保存修改' : '创建人物'}</button>
        <Link href="/admin" className="btn-cancel">取消</Link>
        {dirty && <span className="dirty-hint">有未保存的修改</span>}
      </div>
    </form>
  );
}
