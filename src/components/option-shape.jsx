const SHAPES = [
  // triangle, diamond, circle, square — glyphs only, never tile fills
  'M10 2 L18 16 L2 16 Z',
  'M10 1 L19 10 L10 19 L1 10 Z',
  null,
  'M3 3 H17 V17 H3 Z',
];
const VARS = ['var(--opt-0)', 'var(--opt-1)', 'var(--opt-2)', 'var(--opt-3)'];

export default function OptionShape({ index, size = 20, className = '' }) {
  const i = index % 4;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden="true">
      {i === 2 ? <circle cx="10" cy="10" r="8" fill={VARS[i]} /> : <path d={SHAPES[i]} fill={VARS[i]} />}
    </svg>
  );
}
