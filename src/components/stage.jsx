import { cn } from 'cn';

const WIDTHS = { 480: 'max-w-[480px]', 720: 'max-w-[720px]', 1200: 'max-w-[1200px]' };

export default function Stage({ width = 720, bar = true, className, children }) {
  return (
    <main
      className={cn(
        'flex flex-col items-center px-6 py-16',
        bar ? 'min-h-[calc(100dvh-56px)]' : 'min-h-dvh',
      )}
    >
      <div className={cn('my-auto w-full', WIDTHS[width], className)}>{children}</div>
    </main>
  );
}

export function StageHeading({ title, hint, children, step = false }) {
  return (
    <div className="mb-10 text-center">
      <h1 className={step ? 'type-step' : 'type-display'}>{title}</h1>
      {hint && <p className="mt-3 text-[15px] text-muted-foreground">{hint}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
