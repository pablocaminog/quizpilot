const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(ms) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

export const formatCount = (n) => new Intl.NumberFormat('en').format(n);

export function formatCaptured(ms) {
  return new Date(ms).toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

const pr = new Intl.PluralRules('en');
export const plural = (n, one, other) => `${n} ${pr.select(n) === 'one' ? one : other}`;
