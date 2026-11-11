import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, Square, Globe, FileText, ClipboardType, PenLine } from 'lucide-react';

const KIND_ICONS = { url: Globe, text_upload: FileText, pdf_upload: FileText, paste: ClipboardType, generate: PenLine };

export function SourceChip({ source }) {
  if (!source) return null;
  const Icon = KIND_ICONS[source.kind] ?? FileText;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{source.label}</span>
    </span>
  );
}

export function PromptInput({ value, onChange, onSend, onStop, disabled, streaming, source, placeholder }) {
  const areaRef = useRef(null);
  const grow = () => {
    const el = areaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 8 * 24)}px`;
    }
  };
  return (
    <div className="rounded-md border bg-card shadow-label focus-within:border-signal">
      <textarea
        ref={areaRef}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? 'Describe the quiz you want'}
        aria-label="Describe the quiz you want"
        onChange={(e) => {
          onChange(e.target.value);
          grow();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && value.trim()) onSend();
          }
        }}
        className="w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:outline-none"
      />
      <div className="flex items-center justify-between gap-3 py-2 pr-2 pl-4">
        <SourceChip source={source} />
        {streaming ? (
          <Button type="button" variant="secondary" size="sm" onClick={onStop}>
            <Square className="size-4" aria-hidden="true" /> Stop
          </Button>
        ) : (
          <Button type="button" size="icon-lg" aria-label="Send" disabled={disabled || !value.trim()} onClick={onSend}>
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
