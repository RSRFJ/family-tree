export function brandMark(family) {
  const logo = String(family?.logo_text || '').trim();
  if (logo) return logo.slice(0, 2);
  const title = String(family?.title || '').trim();
  if (title) return title.slice(0, 1);
  return String(family?.surname || '氏').slice(0, 1);
}
