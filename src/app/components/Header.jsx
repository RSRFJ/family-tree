import Link from 'next/link';
import PreviewExit from './PreviewExit';

export default function Header({ title, surname, active }) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link href="/preview" className="brand">
          <span className={"brand-mark" + (String(surname || "").length > 1 ? " two" : "")}>{surname}</span>
          <span className="brand-text">{title}</span>
        </Link>
        <nav className="tabs" aria-label="视图切换">
          <Link href="/preview" className={active === 'list' ? 'tab on' : 'tab'}>列表</Link>
          <Link href="/preview/tree" className={active === 'tree' ? 'tab on' : 'tab'}>树状</Link>
        </nav>
        <div className="who">
          <span className="badge-preview">预览模式</span>
          <PreviewExit />
          <Link href="/admin/login" className="ghost">管理入口</Link>
        </div>
      </div>
    </header>
  );
}
