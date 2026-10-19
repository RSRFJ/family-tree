import { NextResponse } from 'next/server';
import { verifyCode, openPreview } from '@/lib/preview';
import { readJson, errorResponse, clientIp } from '@/lib/http';
import { take } from '@/lib/rate-limit';

const WINDOW = 60_000;
const MAX = process.env.TRUST_PROXY === '1' ? 10 : 30;

export async function POST(req) {
  const limit = take(`preview:${clientIp(req)}`, MAX, WINDOW);
  if (limit.limited) {
    return NextResponse.json(
      { error: '尝试过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  let body;
  try {
    body = await readJson(req, 4096);
  } catch (e) {
    return errorResponse(e);
  }

  const hit = await verifyCode(body.code);
  if (!hit) {
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json({ error: '访问码不正确' }, { status: 401 });
  }
  await openPreview();
  return NextResponse.json({ ok: true });
}
