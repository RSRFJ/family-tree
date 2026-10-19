import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/session';
import { getFamily } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/admin');

  const family = await getFamily();
  const mark = brandMark(family);

  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className={"login-mark" + (mark.length > 1 ? " two" : "")}>{mark}</div>
        <h1>{family.title} · 管理</h1>
        <p className="login-sub">管理员登录</p>
        <LoginForm />
        <Link href="/" className="login-alt">← 返回访问码登录</Link>
      </div>
    </main>
  );
}
