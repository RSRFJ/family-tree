import AdminShell from '@/app/admin/components/AdminShell';
import { requireAdmin } from '@/lib/auth';
import { getFamily } from '@/lib/data';
import { brandMark } from '@/lib/brand';
import PasswordForm from '../components/PasswordForm';

export const dynamic = 'force-dynamic';

const ROLE_LABEL = { admin: '管理员（全部权限）', user: '普通成员（可增删改人物）' };

export default async function MyAccountPage() {
  const user = await requireAdmin();
  const family = await getFamily();

  return (
    <AdminShell user={user} family={family} mark={brandMark(family)}>
      <main className="wrap">
        <div className="form-card">
          <div className="form-head">
            <div>
              <h1>我的账号</h1>
              <p>{user.username} · {ROLE_LABEL[user.role] || user.role}</p>
            </div>
          </div>
          <PasswordForm />
          <p className="muted">修改后其他设备上的登录会失效</p>
        </div>
      </main>
      <footer className="foot wrap">账号与访问 · 停用账号或关闭访问码会立即让其会话失效</footer>
    </AdminShell>
  );
}
