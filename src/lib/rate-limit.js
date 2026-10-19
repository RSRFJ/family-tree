/**
 * 进程内限流桶。带过期清理和硬上限，避免攻击者用无限 key 撑爆内存。
 * 单实例部署足够；多实例部署时应换成 Redis/数据库。
 */
const buckets = new Map();
const MAX_KEYS = 5000;

function prune(now) {
  for (const [key, b] of buckets) {
    if (now - b.start > b.windowMs) buckets.delete(key);
  }
  while (buckets.size > MAX_KEYS) {
    buckets.delete(buckets.keys().next().value);
  }
}

export function take(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > MAX_KEYS * 2) prune(now);
  let b = buckets.get(key);
  if (!b || now - b.start > b.windowMs) {
    b = { start: now, count: 0, windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return {
    limited: b.count > max,
    remaining: Math.max(0, max - b.count),
    retryAfterMs: Math.max(0, b.start + b.windowMs - now),
  };
}

export function reset(key) {
  buckets.delete(key);
}
