export default function Notice({ text }) {
  const body = String(text || '').trim();
  if (!body) return null;
  return (
    <section className="notice" aria-label="公告">
      <span className="notice-tag">公告</span>
      <div className="notice-body">{body}</div>
    </section>
  );
}
