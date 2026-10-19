const GENDERS = new Set(['male', 'female', 'other', 'unknown']);

function parseYear(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1000 || n > 2100) return NaN;
  return n;
}

export function normalizePerson(input = {}) {
  const errors = {};

  const name = String(input.name || '').trim();
  if (!name) errors.name = '请填写姓名';
  else if (name.length > 64) errors.name = '姓名不能超过 64 字';

  const gender = GENDERS.has(input.gender) ? input.gender : 'unknown';

  const birthYear = parseYear(input.birthYear);
  if (Number.isNaN(birthYear)) errors.birthYear = '生年需为 1000–2100 的整数';
  const deathYear = parseYear(input.deathYear);
  if (Number.isNaN(deathYear)) errors.deathYear = '卒年需为 1000–2100 的整数';
  if (!errors.birthYear && !errors.deathYear && birthYear && deathYear && deathYear < birthYear) {
    errors.deathYear = '卒年不能早于生年';
  }

  const birthPlace = String(input.birthPlace || '').trim().slice(0, 120) || null;
  const burialPlace = String(input.burialPlace || '').trim().slice(0, 120) || null;
  const notes = String(input.notes || '').slice(0, 5000);
  const hasFather = Object.prototype.hasOwnProperty.call(input, 'fatherId');
  const fatherId = hasFather ? (input.fatherId ? String(input.fatherId) : null) : undefined;

  return {
    errors,
    value: { name, gender, birthYear, deathYear, birthPlace, burialPlace, notes, fatherId },
  };
}
