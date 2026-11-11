import { plural } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown } from 'lucide-react';

export function Sources({ citations }) {
  if (!citations?.length) return null;
  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        {plural(citations.length, 'source', 'sources')} cited
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {citations.map((c, i) => (
          <div key={i}>
            <div className="text-[13px] font-medium">{c.label}</div>
            <blockquote className="border-l pl-3 text-[14px] text-muted-foreground">{c.excerpt}</blockquote>
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
