import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { writeAudit } from '@/lib/people';

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '仅管理员可修改站点设置' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch = {};

  if ('title' in body) {
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: '标题不能为空' }, { status: 422 });
    if (title.length > 60) return NextResponse.json({ error: '标题不能超过 60 字' }, { status: 422 });
    patch.title = title;
  }
  if ('description' in body) {
    const description = String(body.description || '').trim();
    if (description.length > 200) return NextResponse.json({ error: '简介不能超过 200 字' }, { status: 422 });
    patch.description = description;
  }
  if ('logoText' in body) {
    const logoText = String(body.logoText || '').trim();
    if (logoText.length > 2) return NextResponse.json({ error: '印章文字最多 2 个字' }, { status: 422 });
    patch.logo_text = logoText || null;
  }
  if ('notice' in body) {
    const notice = String(body.notice || '').trim();
    if (notice.length > 500) return NextResponse.json({ error: '公告不能超过 500 字' }, { status: 422 });
    patch.notice = notice || null;
  }

  const keys = Object.keys(patch);
  if (!keys.length) return NextResponse.json({ error: '没有需要保存的内容' }, { status: 400 });

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE family SET ${sets}
        WHERE id = (SELECT id FROM family ORDER BY created_at LIMIT 1)
        RETURNING id, title, description, logo_text, notice`,
      keys.map((k) => patch[k])
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: '站点未初始化' }, { status: 500 });
    }
    await writeAudit(client, { actorId: user.id, action: 'family.update', entity: 'family', entityId: rows[0].id, payload: patch });
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, family: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  } finally {
    client.release();
  }
}
