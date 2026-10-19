import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { readJson, errorResponse } from '@/lib/http';

const ROLES = ['admin','user'];
const HASH_RE = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/;

function validHash(value) {
  const s = String(value || '');
  const m = s.match(HASH_RE);
  if (!m || s.length > 512) return false;
  const [N, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return N >= 16384 && N <= 131072 && r >= 1 && r <= 16 && p >= 1 && p <= 4;
}

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try {
    body = await readJson(req, 8 * 1024 * 1024);
  } catch (e) {
    return errorResponse(e);
  }
  if (body.format !== 'familytree-accounts' || body.version !== 1) {
    return NextResponse.json({ error: '不是账号备份文件' }, { status: 422 });
  }
  if (body.confirm !== 'RESTORE') {
    return NextResponse.json({ error: '请输入 RESTORE 确认' }, { status: 400 });
  }
  const users = Array.isArray(body.users) ? body.users : [];
  const codes = Array.isArray(body.accessCodes) ? body.accessCodes : [];
  if (!users.length) return NextResponse.json({ error: '备份里没有账号' }, { status: 422 });

  for (const u of users) {
    if (!/^[a-z0-9_.-]{3,32}$/.test(String(u.username || ''))) {
      return NextResponse.json({ error: `用户名不合法：${u.username}` }, { status: 422 });
    }
    if (!ROLES.includes(u.role)) return NextResponse.json({ error: `角色不合法：${u.username}` }, { status: 422 });
    if (u.isActive !== undefined && typeof u.isActive !== 'boolean') {
      return NextResponse.json({ error: `启用状态不合法：${u.username}` }, { status: 422 });
    }
    if (String(u.displayName || '').length > 40) {
      return NextResponse.json({ error: `显示名过长：${u.username}` }, { status: 422 });
    }
    if (!validHash(u.passwordHash)) {
      return NextResponse.json({ error: `密码哈希不合法：${u.username}` }, { status: 422 });
    }
  }
  if (!users.some((u) => u.role === 'admin' && u.isActive !== false)) {
    return NextResponse.json({ error: '备份里至少需要一个启用的管理员' }, { status: 422 });
  }
  if (!codes.some((c) => c.isActive !== false)) {
    return NextResponse.json({ error: '备份里至少需要一个启用的访问码' }, { status: 422 });
  }
  for (const c of codes) {
    if (!/^[A-Z0-9]{7,32}$/.test(String(c.code || '').toUpperCase())) {
      return NextResponse.json({ error: `访问码不合法：${c.code}` }, { status: 422 });
    }
  }

  const usernames = users.map((u) => String(u.username).toLowerCase());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM sessions');

    // 恢复是权威操作：备份外的账号必须移除，否则旧的后门账号会继续有效。
    // 默认 admin 账号按产品规则不物理删除，仅在不在备份中时停用。
    await client.query(
      'DELETE FROM users WHERE username <> ALL($1::text[]) AND username <> $2',
      [usernames, 'admin']
    );
    await client.query(
      "UPDATE users SET is_active = false WHERE username = 'admin' AND username <> ALL($1::text[])",
      [usernames]
    );

    for (const u of users) {
      await client.query(
        `INSERT INTO users (username, display_name, password_hash, role, is_active)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (username) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               password_hash = EXCLUDED.password_hash,
               role = EXCLUDED.role,
               is_active = EXCLUDED.is_active`,
        [String(u.username).toLowerCase(), String(u.displayName || u.username).slice(0, 40), u.passwordHash, u.role, u.isActive !== false]
      );
    }

    await client.query('DELETE FROM access_codes');
    for (const c of codes) {
      await client.query(
        `INSERT INTO access_codes (code, label, is_active, use_count)
         VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [String(c.code).toUpperCase(), c.label || null, c.isActive !== false, Number(c.useCount) || 0]
      );
    }
    await client.query('DELETE FROM preview_sessions');

    await client.query(
      "INSERT INTO audit_log (actor_id, action, entity, payload) VALUES ($1,'accounts.import','user',$2)",
      [user.id, JSON.stringify({ users: users.length, codes: codes.length })]
    );
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, users: users.length, codes: codes.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[accounts.import]', e.message);
    return NextResponse.json({ error: '导入失败，请检查备份文件' }, { status: 500 });
  } finally {
    client.release();
  }
}
