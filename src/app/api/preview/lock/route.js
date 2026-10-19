import { NextResponse } from 'next/server';
import { lockPreview } from '@/lib/preview';

export async function POST() {
  await lockPreview();
  return NextResponse.json({ ok: true });
}
