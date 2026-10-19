import { NextResponse } from 'next/server';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function limitFor(pathname) {
  if (pathname === '/api/auth/login' || pathname === '/api/auth/password') return 4 * 1024;
  if (pathname === '/api/preview/unlock') return 4 * 1024;
  if (pathname === '/api/admin/import' || pathname === '/api/admin/accounts/import') return 8 * 1024 * 1024;
  return 1024 * 1024;
}

export function middleware(req) {
  if (!WRITE_METHODS.has(req.method)) return NextResponse.next();

  const pathname = req.nextUrl.pathname;

  // 同站校验：拒绝从其他端口/子域或外站发起的写请求。
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return NextResponse.json({ error: '跨站请求被拒绝' }, { status: 403 });
  }
  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('host');
    const allowed = host ? new Set([`http://${host}`, `https://${host}`]) : null;
    if (!allowed || !allowed.has(origin)) {
      return NextResponse.json({ error: '跨站请求被拒绝' }, { status: 403 });
    }
  }

  // 在进入路由处理前先挡掉超大请求，避免 req.json() 读满内存。
  const len = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(len) && len > limitFor(pathname)) {
    return NextResponse.json({ error: '请求体过大' }, { status: 413 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
