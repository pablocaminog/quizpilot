import { useRef } from 'react';
import { plural } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SpecRow, SpecTag } from '@/components/spec-tag';
import OptionShape from '@/components/option-shape';
import { ArrowDown, ArrowUp, Bot, Check, Plus, Quote, Trash2, X } from 'lucide-react';

const TIMERS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

function IconAction({ label, onClick, disabled, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function QuestionEditor({ q, index, total, generated, onChange, onMove, onDelete }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const setOption = (i, text) => {
    const options = [...q.options];
    options[i] = text;
    set({ options });
  };
  const isGenerated = generated || q.provenance === 'AI-generated';
  return (
    <SpecTag
      data-question={index}
      title={<span className="type-label tabular">Question {index + 1}</span>}
      aside={
        <span className="flex items-center gap-1">
          <Badge variant="secondary" className="mr-2 gap-1">
            {isGenerated ? (
              <><Bot className="size-3" aria-hidden="true" /> AI-generated</>
            ) : (
              <><Quote className="size-3" aria-hidden="true" /> {plural(q.citations?.length ?? 0, 'citation', 'citations')}</>
            )}
          </Badge>
          <IconAction label="Move up" onClick={() => onMove(index, -1)} disabled={index === 0}>
            <ArrowUp className="size-4" aria-hidden="true" />
          </IconAction>
          <IconAction label="Move down" onClick={() => onMove(index, 1)} disabled={index === total - 1}>
            <ArrowDown className="size-4" aria-hidden="true" />
          </IconAction>
          <IconAction label="Delete question" onClick={() => onDelete(index)}>
            <Trash2 className="size-4" aria-hidden="true" />
          </IconAction>
        </span>
      }
    >
      <SpecRow label={<Label htmlFor={`q-${index}-text`}>Question</Label>}>
        <Textarea id={`q-${index}-text`} rows={2} value={q.text} onChange={(e) => set({ text: e.target.value })} />
      </SpecRow>
      <SpecRow label="Answers">
        <div role="radiogroup" aria-label="Correct answer" className="space-y-2">
          {q.options.map((opt, i) => {
            const correct = q.correctIndex === i;
            return (
              <div key={i} className="flex items-center gap-2">
                <OptionShape index={i} size={14} className="shrink-0" />
                <Input value={opt} onChange={(e) => setOption(i, e.target.value)} aria-label={`Option ${i + 1}`} />
                <button
                  role="radio"
                  aria-checked={correct}
                  aria-label={`Mark option ${i + 1} as correct`}
                  onClick={() => set({ correctIndex: i })}
                  className={`flex h-11 w-28 shrink-0 items-center justify-center gap-1.5 rounded-md border text-[13px] font-medium transition-colors ${correct ? 'border-success bg-success-muted text-success' : 'border-input text-muted-foreground hover:text-foreground'}`}
                >
                  {correct && <Check className="size-4" aria-hidden="true" />}
                  Correct
                </button>
                {q.options.length > 2 && (
                  <Button
                    variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`}
                    onClick={() => {
                      const options = q.options.filter((_, j) => j !== i);
                      const correctIndex = q.correctIndex === i ? 0 : q.correctIndex > i ? q.correctIndex - 1 : q.correctIndex;
                      set({ options, correctIndex });
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            );
          })}
          {q.options.length < 4 && (
            <Button variant="ghost" size="sm" className="-ml-3" onClick={() => set({ options: [...q.options, ''] })}>
              <Plus className="size-4" aria-hidden="true" /> Add option
            </Button>
          )}
        </div>
      </SpecRow>
      <SpecRow label="Timer">
        <Select value={String(q.timerSeconds)} onValueChange={(v) => set({ timerSeconds: Number(v) })}>
          <SelectTrigger className="w-36" aria-label="Timer"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIMERS.map((t) => <SelectItem key={t} value={String(t)}>{t} seconds</SelectItem>)}
          </SelectContent>
        </Select>
      </SpecRow>
      <SpecRow label={<Label htmlFor={`q-${index}-rationale`}>Why</Label>}>
        <Textarea id={`q-${index}-rationale`} rows={2} className="text-[14px]" value={q.rationale} onChange={(e) => set({ rationale: e.target.value })} />
      </SpecRow>
      {!isGenerated && (
        <SpecRow label="Source">
          {q.citations?.length ? (
            <div className="space-y-4">
              {q.citations.map((c, i) => (
                <div key={i}>
                  <blockquote className="border-l border-input pl-3.5 text-[14px]">{c.excerpt}</blockquote>
                  <div className="type-small mt-1.5 pl-3.5">{c.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <CitationAdder onAdd={(c) => set({ citations: [c] })} />
          )}
        </SpecRow>
      )}
    </SpecTag>
  );
}

function CitationAdder({ onAdd }) {
  const labelRef = useRef(null);
  const excerptRef = useRef(null);
  return (
    <div className="space-y-2">
      <p className="type-small">Needs a citation from the source.</p>
      <Input ref={labelRef} placeholder="Label" aria-label="Citation label" />
      <Textarea ref={excerptRef} rows={2} placeholder="Verbatim excerpt from the source" aria-label="Citation excerpt" />
      <Button
        variant="secondary" size="sm"
        onClick={() => {
          const label = labelRef.current?.value.trim();
          const excerpt = excerptRef.current?.value.trim();
          if (label && excerpt) onAdd({ label, excerpt });
        }}
      >
        Add citation
      </Button>
    </div>
  );
}
