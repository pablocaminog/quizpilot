import { cn } from 'cn';

export function SpecTag({ title, aside, footer, className, children, as: Tag = 'section', ...props }) {
  return (
    <Tag className={cn('overflow-hidden rounded-md border bg-card shadow-label', className)} {...props}>
      {(title || aside) && (
        <header className="flex min-h-14 items-center gap-3 border-b px-5 py-3">
          <div className="min-w-0 flex-1 text-[17px] font-medium">{title}</div>
          {aside}
        </header>
      )}
      <div className="divide-y">{children}</div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">{footer}</footer>}
    </Tag>
  );
}

export function SpecRow({ label, className, children }) {
  return (
    <div className={cn('grid gap-1.5 px-5 py-3.5 sm:grid-cols-[120px_1fr] sm:items-baseline sm:gap-4', className)}>
      {label ? <div className="type-label">{label}</div> : <div className="hidden sm:block" />}
      <div className="min-w-0 text-[15px]">{children}</div>
    </div>
  );
}
