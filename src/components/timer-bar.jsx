import { useEffect, useMemo, useRef, useState } from 'react';

// The 8px top drain bar. Remaining time derives only from server values:
// offset = serverNowMs - Date.now() once per question, then
// remaining = deadlineMs - (Date.now() + offset).
export function useServerClock() {
  const offsetRef = useRef(0);
  const setServerNow = (serverNowMs) => {
    if (typeof serverNowMs === 'number') offsetRef.current = serverNowMs - Date.now();
  };
  const now = () => Date.now() + offsetRef.current;
  return { setServerNow, now };
}

export default function TimerBar({ deadlineMs, now, active }) {
  const [remaining, setRemaining] = useState(() => (deadlineMs ? Math.max(0, deadlineMs - now()) : 0));
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const barRef = useRef(null);
  const startRef = useRef({ at: 0, from: 0 });

  useEffect(() => {
    if (!deadlineMs || !active) return;
    const from = Math.max(0, deadlineMs - now());
    startRef.current = { at: now(), from };
    setRemaining(from);
    if (barRef.current && !reduced) {
      barRef.current.style.transition = 'none';
      barRef.current.style.transform = 'scaleX(1)';
      void barRef.current.offsetWidth;
      barRef.current.style.transition = `transform ${from}ms linear`;
      barRef.current.style.transform = 'scaleX(0)';
    }
    const tick = () => setRemaining(Math.max(0, deadlineMs - now()));
    const id = reduced ? setInterval(tick, 1000) : setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadlineMs, active]);

  if (!active || !deadlineMs) return null;
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-2 bg-muted" role="timer" aria-label={`${seconds} seconds remaining`}>
      <div
        ref={barRef}
        className="h-full w-full"
        style={{
          transformOrigin: 'left',
          background: seconds <= 5 ? 'var(--destructive)' : 'var(--primary)',
          ...(reduced ? { transform: `scaleX(${startRef.current.from ? remaining / startRef.current.from : 1})` } : {}),
        }}
      />
    </div>
  );
}
