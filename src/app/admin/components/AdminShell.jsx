"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const I = {
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  tree: <><circle cx="12" cy="4.5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M12 6.5v3.5M5 17v-2.5h14V17" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /><path d="M10 11v5M14 11v5" /></>,
  audit: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 11h6M9 15h4" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 20a5.4 5.4 0 0 0-2.2-4" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" /></>,
  db: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  chev: <path d="M15 6l-6 6 6 6" />,
  out: <path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8 2 2-2 2 2 2-2 2-2-2-2 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({ name }) {
  return (
    <svg className="sico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>
  );
}

function Item({ href, icon, label, active, external }) {
  return (
    <Link href={href} className={"sitem" + (active ? " on" : "")}
      target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      <Icon name={icon} />
      <span className="slabel">{label}</span>
    </Link>
  );
}

export default function AdminShell({ user, family, mark, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ft_nav_collapsed');
    if (saved === '1') setCollapsed(true);
    else if (saved === '0') setCollapsed(false);
    else if (window.innerWidth < 900) setCollapsed(true);
  }, []);


  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('ft_nav_collapsed', next ? '1' : '0');
  }

  const on = (p) => (p === '/admin' ? pathname === '/admin' : pathname.startsWith(p));


  const TITLES = [
    ['/admin/people/new', '新增人物'],
    ['/admin/people', '编辑人物'],
    ['/admin/tree', '树状图'],
    ['/admin/trash', '回收站'],
    ['/admin/audit', '审计日志'],
    ['/admin/accounts/members', '成员账号'],
    ['/admin/accounts/codes', '访问码'],
    ['/admin/accounts', '我的账号'],
    ['/admin/settings', '站点设置'],
    ['/admin/data', '数据备份'],
    ['/admin', '人物列表'],
  ];
  const title = (TITLES.find(([p]) => (p === '/admin' ? pathname === '/admin' : pathname.startsWith(p))) || [null, '管理'])[1];

  return (
    <div className={"shell" + (collapsed ? " mini" : "")}>
      {drawer && <div className="smask" onClick={() => setDrawer(false)} />}
      <aside className={"shell-side" + (drawer ? " open" : "")}>
        <Link href="/admin" className="sbrand">
          <span className="sseal">{mark}</span>
          <span className="sbt"><b>{family.title}</b><i>管理后台</i></span>
        </Link>

        <nav className="snav">
          <div className="sgroup">
            <div className="sglabel">内容</div>
            <Item href="/admin" icon="list" label="人物列表" active={pathname === '/admin' || pathname.startsWith('/admin/people')} />
            <Item href="/admin/tree" icon="tree" label="树状图" active={on('/admin/tree')} />
          </div>
          {user.role === 'admin' && (
            <div className="sgroup">
              <div className="sglabel">管理</div>
              <Item href="/admin/trash" icon="trash" label="回收站" active={on('/admin/trash')} />
              <Item href="/admin/audit" icon="audit" label="审计日志" active={on('/admin/audit')} />
            </div>
          )}
          <div className="sgroup">
            <div className="sglabel">账号</div>
            <Item href="/admin/accounts" icon="user" label="我的账号" active={pathname === '/admin/accounts'} />
            {user.role === 'admin' && <Item href="/admin/accounts/members" icon="users" label="成员账号" active={pathname === '/admin/accounts/members'} />}
            {user.role === 'admin' && <Item href="/admin/accounts/codes" icon="key" label="访问码" active={pathname === '/admin/accounts/codes'} />}
          </div>
          <div className="sgroup">
            <div className="sglabel">系统</div>
            {user.role === 'admin' && <Item href="/admin/settings" icon="gear" label="站点设置" active={on('/admin/settings')} />}
            {user.role === 'admin' && <Item href="/admin/data" icon="db" label="数据备份" active={on('/admin/data')} />}
            <Item href="/preview" icon="out" label="查看预览页 ↗" external />
          </div>
        </nav>

        <div className="sfoot">
          <div className="suser">
            <span className="savatar">{(user.display_name || user.username || 'A').slice(0, 1)}</span>
            <span className="sbt"><b>{user.display_name}</b><i>{user.role === 'admin' ? '管理员' : '普通成员'}</i></span>
          </div>
          <button className="slogout" title="退出登录"
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/admin/login'); router.refresh(); }}>
            <Icon name="out" /><span className="slabel">退出</span>
          </button>
        </div>

        <button className="stoggle" onClick={toggle} aria-label={collapsed ? '展开导航' : '收起导航'}>
          <Icon name="chev" />
        </button>
        <button className="sclose" onClick={() => setDrawer(false)} aria-label="关闭导航">
          <Icon name="close" />
        </button>
      </aside>

      <div className="shell-body">
        <div className="shell-top">
          <button className="mnav" onClick={() => setDrawer(true)} aria-label="打开导航">
            <Icon name="menu" />
          </button>
          <span className="stitle">{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
