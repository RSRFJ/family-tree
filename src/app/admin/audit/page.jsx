import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

const LABELS = {
  'auth.login': '登录',
  'auth.login_failed': '登录失败',
  'auth.password': '修改密码',
  'person.create': '新增人物',
  'person.update': '修改人物',
  'person.delete': '删除人物',
  'person.restore': '恢复人物',
  'person.purge': '彻底删除',
  'user.create': '新增账号',
  'user.update': '修改账号',
  'user.delete': '删除账号',
  'user.password': '重置密码',
  'family.update': '修改站点信息',
  'access.create': '新增访问码',
  'access.toggle': '启停访问码',
  'access.delete': '删除访问码',
  'accounts.import': '导入账号备份',
  'accounts.export': '导出账号备份',
  'data.export': '导出族谱数据',
  'backup.download': '下载数据库备份',
  'data.import': '恢复族谱数据',
};

const PAGE_SIZE = 50;

function buildQuery(base, extra = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...extra })) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export default async function AuditPage({ searchParams }) {
  const user = await requireAdmin();
  if (user.role !== 'admin') redirect('/admin');
  const family = await getFamily();

  const sp = (await searchParams) || {};
  const keyword = String(sp.q || '').trim();
  const action = String(sp.action || '').trim();
  const from = String(sp.from || '').trim();
  const to = String(sp.to || '').trim();
  const filters = { q: keyword, action, from, to };

  const where = [];
  const params = [];
  if (keyword) {
    params.push(`%${keyword}%`);
    where.push(`(coalesce(p.display_name, a.payload->>'name', '') ILIKE $${params.length}
                 OR coalesce(u.display_name, '') ILIKE $${params.length}
                 OR coalesce(u.username, '') ILIKE $${params.length}
                 OR coalesce(a.payload::text, '') ILIKE $${params.length})`);
  }
  if (action && LABELS[action]) {
    params.push(action);
    where.push(`a.action = $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    params.push(from);
    where.push(`a.created_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    params.push(to);
    where.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const FROM = `FROM audit_log a
                LEFT JOIN users u ON u.id = a.actor_id
                LEFT JOIN person p ON a.entity = 'person' AND p.id = a.entity_id`;

  const { rows: cnt } = await q(`SELECT count(*)::int AS c ${FROM} ${whereSql}`, params);
  const total = cnt[0]?.c || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let page = Math.max(1, Number(sp.page) || 1);
  if (page > pages) page = pages;

  const listParams = [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE];
  const { rows } = await q(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.created_at,
            coalesce(u.display_name, u.username, '—') AS actor,
            coalesce(p.display_name,
                     a.payload->>'name',
                     a.payload->'after'->>'name',
                     a.payload->'before'->>'name',
                     a.payload->>'username') AS target,
            (a.entity = 'person' AND p.id IS NULL) AS gone
       ${FROM} ${whereSql}
      ORDER BY a.id DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <form className="filters" method="get">
          <input className="f-input" name="q" defaultValue={keyword} placeholder="搜索操作人 / 人物 / 内容" />
          <select className="f-select" name="action" defaultValue={action}>
            <option value="">全部动作</option>
            {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="f-date">从 <input type="date" name="from" defaultValue={from} /></label>
          <label className="f-date">到 <input type="date" name="to" defaultValue={to} /></label>
          <button className="primary f-btn">筛选</button>
          <Link href="/admin/audit" className="f-reset">重置</Link>
        </form>

        <div className="audit-meta">
          <span>共 {total} 条 · 第 {page}/{pages} 页 · 超过一年的记录每日自动清理</span>
        </div>

        <table className="audit">
          <thead>
            <tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                <td>{r.actor}</td>
                <td>{LABELS[r.action] || r.action}</td>
                <td>{r.target ? r.target + (r.gone ? '（已彻底删除）' : '') : (r.entity === 'user' ? '本人' : '—')}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">没有符合条件的记录</td></tr>}
          </tbody>
        </table>

        <nav className="pager" aria-label="分页">
          {page > 1
            ? <Link href={`/admin/audit${buildQuery(filters, { page: page - 1 })}`}>← 上一页</Link>
            : <span className="off">← 上一页</span>}
          <span className="pageno">{page} / {pages}</span>
          {page < pages
            ? <Link href={`/admin/audit${buildQuery(filters, { page: page + 1 })}`}>下一页 →</Link>
            : <span className="off">下一页 →</span>}
        </nav>
      </main>
      <footer className="foot wrap">审计日志不可编辑 · 保留一年</footer>
    </AdminShell>
  );
}
