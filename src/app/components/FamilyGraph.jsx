"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const NODE_W = 168;
const NODE_H = 52;
const COL_W = 208;
const SLOT = 104;
const TOP = 80;
const LEFT = 44;

function buildLayout(people, relations) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = new Map(people.map((p) => [p.id, []]));
  const parentOf = new Map();

  for (const r of relations) {
    if (!byId.has(r.parent) || !byId.has(r.child)) continue;
    children.get(r.parent).push(r.child);
    parentOf.set(r.child, r.parent);
  }
  for (const arr of children.values()) {
    arr.sort((a, b) => (byId.get(a).birthYear || 0) - (byId.get(b).birthYear || 0));
  }
  const roots = people
    .filter((p) => !parentOf.has(p.id))
    .sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0));

  const pos = new Map();
  let slot = 0;
  let maxDepth = 0;

  function visit(id, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(id) || [];
    let y;
    if (!kids.length) {
      y = TOP + slot * SLOT;
      slot += 1;
    } else {
      const ys = kids.map((k) => visit(k, depth + 1));
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    pos.set(id, { x: LEFT + depth * COL_W, y });
    return y;
  }
  roots.forEach((r) => visit(r.id, 0));

  const maxY = pos.size ? Math.max(...[...pos.values()].map((p) => p.y)) : TOP;
  return {
    pos,
    width: LEFT * 2 + maxDepth * COL_W + NODE_W,
    height: maxY + NODE_H + 80,
    children,
    parentOf,
    roots,
  };
}

function lifespan(p) {
  if (!p.birthYear && !p.deathYear) return '生卒未详';
  return `${p.birthYear ?? '?'}${p.deathYear ? `–${p.deathYear}` : ' –'}`;
}

export default function FamilyGraph({ people, relations, initialView = null, initialFocusId = null, mode = 'preview' }) {
  const layout = useMemo(() => buildLayout(people, relations), [people, relations]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const [view, setView] = useState(initialView || 'graph');
  const [selectedId, setSelectedId] = useState(() => {
    if (initialFocusId) {
      const hit = people.find((p) => p.id === initialFocusId || p.legacy_id === initialFocusId);
      if (hit) return hit.id;
    }
    return layout.roots[0]?.id || null;
  });
  const [query, setQuery] = useState('');
  const [scale, setScale] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const viewportRef = useRef(null);
  const nodeRefs = useRef(new Map());

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!initialView && mobile) setView('focus');
  }, [mobile, initialView]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp || view !== 'graph') return;
    const next = Math.min(1, (vp.clientWidth - 28) / layout.width);
    setScale(Math.max(0.5, Number(next.toFixed(2))));
  }, [layout.width, view]);

  const selected = selectedId ? byId.get(selectedId) : null;

  const ancestors = useMemo(() => {
    const set = new Set();
    let cur = selectedId;
    while (cur && layout.parentOf.has(cur)) {
      cur = layout.parentOf.get(cur);
      set.add(cur);
    }
    return set;
  }, [selectedId, layout.parentOf]);

  const matches = useMemo(() => {
    const kw = query.trim().toLowerCase();
    if (!kw) return [];
    return people
      .filter((p) => p.name.toLowerCase().includes(kw) || (p.notes || '').toLowerCase().includes(kw))
      .slice(0, 8);
  }, [people, query]);

  function focusPerson(id) {
    setSelectedId(id);
    setPanelOpen(true);
    const el = nodeRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  function fit() {
    const vp = viewportRef.current;
    if (!vp) return;
    const next = Math.min(1, (vp.clientWidth - 32) / layout.width);
    setScale(Math.max(0.55, Number(next.toFixed(2))));
  }

  return (
    <div className={`graph ${view === 'focus' ? 'is-focus' : ''}`}>
      <div className="graph-toolbar">
        <div className="seg" role="tablist" aria-label="树状图模式">
          <button className={view === 'graph' ? 'seg-btn on' : 'seg-btn'} onClick={() => setView('graph')}>全局</button>
          <button className={view === 'focus' ? 'seg-btn on' : 'seg-btn'} onClick={() => setView('focus')}>聚焦</button>
        </div>

        {view === 'graph' && (
          <div className="graph-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索并定位到树上…"
              aria-label="搜索家族成员"
            />
            {matches.length > 0 && (
              <ul className="suggest">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        setQuery('');
                        focusPerson(m.id);
                      }}
                    >
                      <span className="s-name">{m.name}</span>
                      <span className="s-meta">{m.generation ? `第${m.generation}世` : ''} {lifespan(m)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view === 'graph' && (
          <div className="zoom">
            <button onClick={() => setScale((s) => Math.max(0.55, Number((s - 0.1).toFixed(2))))} aria-label="缩小">−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(1.6, Number((s + 0.1).toFixed(2))))} aria-label="放大">＋</button>
            <button className="fit" onClick={fit}>适应</button>
          </div>
        )}
      </div>

      {view === 'graph' ? (
        <div className="graph-body">
          <div className="graph-viewport" ref={viewportRef}>
            <div className="graph-canvas" style={{ width: layout.width * scale, height: layout.height * scale }}>
              <div
                className="graph-inner"
                style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
              >
                <svg width={layout.width} height={layout.height} aria-hidden="true">
                  {[...layout.pos.entries()].map(([pid, pp]) =>
                    (layout.children.get(pid) || []).map((cid) => {
                      const cp = layout.pos.get(cid);
                      if (!cp) return null;
                      const x1 = pp.x + NODE_W;
                      const y1 = pp.y + NODE_H / 2;
                      const x2 = cp.x;
                      const y2 = cp.y + NODE_H / 2;
                      const dx = Math.max(10, Math.min(38, (x2 - x1) / 2));
                      const active = pid === selectedId || cid === selectedId || ancestors.has(pid);
                      return (
                        <path
                          key={`${pid}-${cid}`}
                          d={`M${x1} ${y1} C${x1 + dx} ${y1},${x2 - dx} ${y2},${x2} ${y2}`}
                          fill="none"
                          stroke={active ? '#2f6b4f' : '#d3cbba'}
                          strokeWidth={active ? 2 : 1.4}
                          opacity={active ? 1 : 0.9}
                        />
                      );
                    })
                  )}
                </svg>

                {[...layout.pos.entries()].map(([pid, p]) => {
                  const person = byId.get(pid);
                  if (!person) return null;
                  const isSel = pid === selectedId;
                  const isAnc = ancestors.has(pid);
                  return (
                    <button
                      key={pid}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(pid, el);
                        else nodeRefs.current.delete(pid);
                      }}
                      className={`gnode ${isSel ? 'sel' : ''} ${isAnc ? 'anc' : ''}`}
                      style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                      onClick={() => { setSelectedId(pid); setPanelOpen(true); }}
                      aria-pressed={isSel}
                    >
                      <span className="gn-name">{person.name}</span>
                      <span className="gn-years">{lifespan(person)}</span>
                      <span className="gn-gen">{person.generation ? `${person.generation}世` : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {panelOpen && (
            <PersonPanel
              person={selected}
              byId={byId}
              layout={layout}
              onPick={focusPerson}
              mode={mode}
              onClose={() => setPanelOpen(false)}
              onFocus={() => setView('focus')}
            />
          )}
        </div>
      ) : (
        <FocusView
          person={selected}
          byId={byId}
          layout={layout}
          onPick={setSelectedId}
          onBack={() => setView('graph')}
          mode={mode}
        />
      )}
    </div>
  );
}

function PersonPanel({ person, byId, layout, onPick, mode, onClose, onFocus }) {
  if (!person) return <aside className="side-panel"><p className="muted">选择一个人物</p></aside>;
  const father = layout.parentOf.get(person.id);
  const kids = layout.children.get(person.id) || [];
  const siblings = father ? (layout.children.get(father) || []).filter((id) => id !== person.id) : [];

  return (
    <aside className="side-panel">
      <button className="sp-close" onClick={onClose} aria-label="关闭详情">×</button>
      <div className="sp-kicker">当前人物</div>
      <h2 className="sp-name">{person.name}</h2>
      <div className="sp-meta">{person.generation ? `第 ${person.generation} 世` : ''} {lifespan(person)}</div>

      <dl className="sp-list">
        <dt>父</dt>
        <dd>{father ? <button onClick={() => onPick(father)}>{byId.get(father)?.name}</button> : '—'}</dd>
        <dt>子女</dt>
        <dd>{kids.length ? kids.map((id) => (
          <button key={id} onClick={() => onPick(id)}>{byId.get(id)?.name}</button>
        )) : '—'}</dd>
        <dt>同辈</dt>
        <dd>{siblings.length ? siblings.map((id) => (
          <button key={id} onClick={() => onPick(id)}>{byId.get(id)?.name}</button>
        )) : '—'}</dd>
      </dl>

      {person.notes && <p className="sp-notes">{person.notes}</p>}

      <div className="sp-actions">
        <button className="sp-primary" onClick={onFocus}>聚焦此人</button>
        {mode === 'admin' && <span className="sp-hint">编辑功能开发中</span>}
      </div>
    </aside>
  );
}

function FocusView({ person, byId, layout, onPick, onBack, mode }) {
  if (!person) return <p className="empty">暂无数据</p>;
  const father = layout.parentOf.get(person.id);
  const kids = layout.children.get(person.id) || [];
  const siblings = father ? (layout.children.get(father) || []).filter((id) => id !== person.id) : [];

  const chain = [];
  let cur = person.id;
  while (cur) {
    chain.unshift(cur);
    cur = layout.parentOf.get(cur);
  }

  return (
    <div className="focus">
      <div className="focus-top">
        <div className="crumbs">
          {chain.map((id, i) => (
            <span key={id}>
              {i > 0 && <i>›</i>}
              <button className={id === person.id ? 'crumb on' : 'crumb'} onClick={() => onPick(id)}>
                {byId.get(id)?.name}
              </button>
            </span>
          ))}
        </div>
        <button className="ghost" onClick={onBack}>返回全局</button>
      </div>

      <div className="focus-stage">
        <div className="gen-row">
          <div className="gen-label">父辈</div>
          {father ? (
            <button className="fcard up" onClick={() => onPick(father)}>
              <span className="fc-name">{byId.get(father)?.name}</span>
              <span className="fc-meta">{lifespan(byId.get(father))}</span>
            </button>
          ) : (
            <span className="fcard ghosted">始祖 · 无父系记录</span>
          )}
        </div>

        {siblings.length > 0 && (
          <div className="gen-row">
            <div className="gen-label">同辈</div>
            <div className="chip-row">
              {siblings.map((id) => (
                <button key={id} className="chip" onClick={() => onPick(id)}>{byId.get(id)?.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="focus-center">
          <div className="big-card">
            <div className="bc-name">{person.name}</div>
            <div className="bc-meta">{person.generation ? `第 ${person.generation} 世 · ` : ''}{lifespan(person)}</div>
            {person.notes && <p className="bc-notes">{person.notes}</p>}
          </div>
        </div>

        <div className="gen-row">
          <div className="gen-label">子辈</div>
          {kids.length ? (
            <div className="kid-row">
              {kids.map((id) => (
                <button key={id} className="fcard down" onClick={() => onPick(id)}>
                  <span className="fc-name">{byId.get(id)?.name}</span>
                  <span className="fc-meta">{lifespan(byId.get(id))}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="fcard ghosted">暂无子女记录</span>
          )}
        </div>
      </div>

      <p className="focus-hint">点击任意人物即可以他为中心 · {mode === 'admin' ? '管理视图' : '预览视图'}</p>
    </div>
  );
}
