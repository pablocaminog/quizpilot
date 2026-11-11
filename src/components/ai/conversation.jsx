import { useEffect, useRef } from 'react';
import { cn } from 'cn';

export function Conversation({ children, className }) {
  const ref = useRef(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [children]);
  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4', className)}
    >
      {children}
    </div>
  );
}

export function DrafterMessage({ children }) {
  return (
    <div className="max-w-[85%]">
      <div className="mb-1 text-[13px] text-muted-foreground">Drafter</div>
      <div className="text-[15px]">{children}</div>
    </div>
  );
}

export function HostMessage({ children }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-lg bg-muted px-4 py-3 text-[15px]">{children}</div>
  );
}
