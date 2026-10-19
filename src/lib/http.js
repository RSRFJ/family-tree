import { NextResponse } from 'next/server';

/** 读取 JSON 请求体，并强制字节上限，避免大 body 打爆内存。 */
export async function readJson(req, maxBytes = 64 * 1024) {
  const len = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(len) && len > maxBytes) {
    const e = new Error('请求体过大');
    e.status = 413;
    throw e;
  }
  if (!req.body) return {};
  const reader = req.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        const e = new Error('请求体过大');
        e.status = 413;
        throw e;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  if (!total) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const e = new Error('请求格式不正确');
    e.status = 400;
    throw e;
  }
}

export function errorResponse(e) {
  const status = Number(e?.status) || 500;
  if (status >= 500) console.error('[api]', e?.message || e);
  return NextResponse.json(
    { error: status >= 500 ? '服务暂时不可用' : e.message },
    { status }
  );
}

/**
 * 只信任可信反代写入的 XFF。默认关闭，避免客户端自带 X-Forwarded-For 伪造限流键。
 * 反代场景在 .env 设置 TRUST_PROXY=1，并确保反代会覆盖该头。
 */
export function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return 'direct';
}

/** 同站校验：拒绝 same-site（同主机不同端口/子域）和跨站写请求。 */
export function sameOriginError(req) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return NextResponse.json({ error: '跨站请求被拒绝' }, { status: 403 });
  }
  const origin = req.headers.get('origin');
  if (!origin) return null;
  const host = req.headers.get('host');
  if (!host) return NextResponse.json({ error: '请求来源不合法' }, { status: 403 });
  const allowed = new Set([`http://${host}`, `https://${host}`]);
  if (!allowed.has(origin)) {
    return NextResponse.json({ error: '跨站请求被拒绝' }, { status: 403 });
  }
  return null;
}
