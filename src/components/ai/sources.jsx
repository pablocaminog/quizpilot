import { plural } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown } from 'lucide-react';

export function Sources({ citations }) {
  if (!citations?.length) return null;
  return (
    <details className="group">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        {plural(citations.length, 'source', 'sources')} cited
      </summary>
      <div className="mt-2 space-y-4">
        {citations.map((c, i) => (
          <div key={i}>
            <blockquote className="border-l border-input pl-3.5 text-[14px]">{c.excerpt}</blockquote>
            <div className="type-small mt-1.5 pl-3.5">{c.label}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function InlineCitation({ index, citation }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="ml-1 align-super text-[11px]">[{index + 1}]</Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{citation.excerpt}</TooltipContent>
    </Tooltip>
  );
}
