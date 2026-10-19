import { redirect } from 'next/navigation';
import { getSessionUser } from './session';
import { hasPreview } from './preview';

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  return user;
}

export async function requirePreview() {
  const ok = await hasPreview();
  if (!ok) return false;
  return true;
}

export async function apiUser() {
  return getSessionUser();
}
