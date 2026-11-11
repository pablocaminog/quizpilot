import { useRef } from 'react';
import { plural } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sources } from '@/components/ai/sources';
import OptionShape from '@/components/option-shape';
import { ArrowDown, ArrowUp, Bot, Check, Quote, Trash2, X } from 'lucide-react';

const TIMERS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

function IconAction({ label, onClick, disabled, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label={label} onClick={onClick} disabled={disabled}>
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
    <section className="rounded-lg border" data-question={index}>
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="tabular text-[13px] font-medium text-muted-foreground">Question {index + 1}</span>
        {isGenerated ? (
          <Badge variant="outline" className="gap-1">
            <Bot className="size-3" aria-hidden="true" /> AI-generated
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Quote className="size-3" aria-hidden="true" /> {plural(q.citations?.length ?? 0, 'citation', 'citations')}
          </Badge>
        )}
        <span className="ml-auto flex items-center">
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
      </div>
      <div className="space-y-4 p-4">
        <div>
          <Label htmlFor={`q-${index}-text`} className="sr-only">Question</Label>
          <Textarea id={`q-${index}-text`} rows={2} className="text-[15px]" value={q.text} onChange={(e) => set({ text: e.target.value })} />
        </div>
        <div role="radiogroup" aria-label="Correct answer" className="space-y-2">
          {q.options.map((opt, i) => {
            const correct = q.correctIndex === i;
            return (
              <div key={i} className="flex h-11 items-center gap-2">
                <OptionShape index={i} />
                <Input value={opt} onChange={(e) => setOption(i, e.target.value)} aria-label={`Option ${i + 1}`} className="h-11" />
                <button
                  role="radio"
                  aria-checked={correct}
                  aria-label={`Mark option ${i + 1} as correct`}
                  onClick={() => set({ correctIndex: i })}
                  className={`flex h-11 w-28 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${correct ? 'border-success text-success' : 'text-muted-foreground'}`}
                >
                  {correct && <Check className="size-4" aria-hidden="true" />}
                  Correct
                </button>
                {q.options.length > 2 && (
                  <Button
                    variant="ghost" size="icon" className="size-9 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label={`Remove option ${i + 1}`}
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
            <Button variant="ghost" size="sm" onClick={() => set({ options: [...q.options, ''] })}>
              Add option
            </Button>
          )}
        </div>
        <div className="flex items-end gap-4">
          <div className="space-y-2">
            <Label>Timer</Label>
            <Select value={String(q.timerSeconds)} onValueChange={(v) => set({ timerSeconds: Number(v) })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMERS.map((t) => <SelectItem key={t} value={String(t)}>{t} seconds</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor={`q-${index}-rationale`}>Rationale</Label>
            <Textarea id={`q-${index}-rationale`} rows={2} className="text-[14px]" value={q.rationale} onChange={(e) => set({ rationale: e.target.value })} />
          </div>
        </div>
        {!isGenerated && <Sources citations={q.citations} />}
        {!isGenerated && !q.citations?.length && (
          <CitationAdder onAdd={(c) => set({ citations: [c] })} />
        )}
      </div>
    </section>
  );
}

function CitationAdder({ onAdd }) {
  const labelRef = useRef(null);
  const excerptRef = useRef(null);
  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <p className="text-[13px] text-muted-foreground">Hand-written questions need a citation from the source.</p>
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
