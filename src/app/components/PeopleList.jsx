"use client";

import { useEffect, useMemo, useState } from 'react';

const UNDO_SECONDS = 10;

function lifespan(p) {
  if (!p.birthYear && !p.deathYear) return '';
  return `${p.birthYear ?? '?'}${p.deathYear ? ` – ${p.deathYear}` : ' – '}`;
}

export default function PeopleList({ people, relations, canEdit }) {
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState(() => new Set());
  const [pending, setPending] = useState([]);
  const [seconds, setSeconds] = useState(UNDO_SECONDS);
  const [error, setError] = useState('');

  const nameById = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  const fatherOf = useMemo(() => {
    const m = new Map();
    for (const r of relations) m.set(r.child, r.parent);
    return m;
  }, [relations]);

  const childrenOf = useMemo(() => {
    const m = new Map();
    for (const r of relations) {
      if (!m.has(r.parent)) m.set(r.parent, []);
      m.get(r.parent).push(r.child);
    }
    return m;
  }, [relations]);

  const visible = useMemo(() => {
    const kw = query.trim().toLowerCase();
    return people
      .filter((p) => !removed.has(p.id))
      .filter((p) => {
        if (!kw) return true;
        return (
          (p.name || '').toLowerCase().includes(kw) ||
          (p.notes || '').toLowerCase().includes(kw)
        );
      });
  }, [people, query, removed]);

  const generations = useMemo(() => {
    const m = new Map();
    for (const p of visible) {
      const g = p.generation ?? 0;
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(p);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  useEffect(() => {
    if (!pending.length) return;
    setSeconds(UNDO_SECONDS);
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  useEffect(() => {
    if (pending.length && seconds <= 0) setPending([]);
  }, [seconds, pending.length]);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && pending.length) {
        e.preventDefault();
        undoAll();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  async function remove(p) {
    if (!canEdit) return;
    setError('');
    const res = await fetch(`/api/people/${p.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('删除失败，请重试');
      return;
    }
    setRemoved((prev) => new Set(prev).add(p.id));
    setPending((prev) => [...prev, { id: p.id, name: p.name }]);
  }

  async function undoAll() {
    const items = pending;
    setPending([]);
    setRemoved((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.delete(i.id));
      return next;
    });
    await Promise.all(
      items.map((i) => fetch(`/api/people/${i.id}/restore`, { method: 'POST' }))
    );
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索姓名或简介"
          aria-label="搜索家族成员"
        />
        <span className="count">{visible.length} 人</span>
        {canEdit && <a className="btn-add" href="/admin/people/new">＋ 新增人物</a>}
      </div>

      {error && <p className="error">{error}</p>}

      {generations.length === 0 && <p className="empty">没有匹配的成员</p>}

      {generations.map(([g, list]) => (
        <section className="gen" key={g}>
          <div className="gen-head">
            <h2>{g ? `第 ${g} 世` : '未分世'}</h2>
            <span>{list.length} 人</span>
          </div>
          <div className="grid">
            {list.map((p) => {
              const father = fatherOf.get(p.id);
              const kids = childrenOf.get(p.id) || [];
              return (
                <article className="card" key={p.id}>
                  <div className="card-top">
                    <h3>{p.name}</h3>
                    {canEdit && (
                      <div className="card-actions">
                        <a className="edit" href={`/admin/people/${p.id}`} aria-label={`编辑 ${p.name}`}>编辑</a>
                        <button
                          className="del"
                          onClick={() => remove(p)}
                          aria-label={`删除 ${p.name}`}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="years">{lifespan(p)}</div>
                  <div className="rel">
                    {father && <span>父：{nameById.get(father) || '—'}</span>}
                    {kids.length > 0 && (
                      <span>子女：{kids.map((k) => nameById.get(k)).filter(Boolean).join('、')}</span>
                    )}
                  </div>
                  {p.notes && <p className="notes">{p.notes}</p>}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {pending.length > 0 && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-text">
            已删除
            {pending.length > 1 ? ` ${pending.length} 人` : `「${pending[0].name}」`}
          </span>
          <button className="toast-btn" onClick={undoAll}>撤销</button>
          <span className="toast-left">{seconds}s</span>
          <span
            className="toast-bar"
            style={{ width: `${Math.max(0, (seconds / UNDO_SECONDS) * 100)}%` }}
          />
        </div>
      )}
    </>
  );
}
