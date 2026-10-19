import fs from 'node:fs/promises';
import path from 'node:path';
import { getSessionUser } from '@/lib/session';
import { q } from '@/lib/db';

const DIR = process.env.BACKUP_DIR || '/app/backups';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });

  let names = [];
  try {
    names = (await fs.readdir(DIR)).filter((n) => n.endsWith('.dump') && !n.includes('/'));
  } catch {
    return Response.json({ error: '备份目录不可用' }, { status: 500 });
  }
  if (!names.length) return Response.json({ error: '还没有数据库备份' }, { status: 404 });

  const root = await fs.realpath(DIR);
  const items = [];
  for (const n of names) {
    const full = path.join(DIR, n);
    try {
      const st = await fs.lstat(full);
      if (!st.isFile() || st.isSymbolicLink()) continue; // 只接受普通文件，拒绝符号链接
      const real = await fs.realpath(full);
      if (!real.startsWith(root + path.sep)) continue;
      items.push({ name: n, size: st.size, mtimeMs: st.mtimeMs, real });
    } catch {
      // 单个损坏/不可读文件不影响其他备份
    }
  }
  if (!items.length) return Response.json({ error: '没有可用的数据库备份' }, { status: 404 });
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = items[0];

  const buf = await fs.readFile(latest.real);
  await q(
    "INSERT INTO audit_log (actor_id, action, entity, payload) VALUES ($1,'backup.download','backup',$2)",
    [user.id, JSON.stringify({ name: latest.name, size: buf.length })]
  ).catch(() => {});

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${latest.name.replace(/["\\\r\n]/g, '_')}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  });
}
