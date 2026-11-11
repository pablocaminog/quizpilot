import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuestionEditor from '@/components/views/question-editor';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { AlertCircle, Loader2, Plus, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { plural } from '@/lib/format';

const BLANK = (generated) => ({
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timerSeconds: 20,
  rationale: '',
  provenance: generated ? 'AI-generated' : 'source',
  citations: [],
});

export function PublishDialog({ open, onOpenChange, onConfirm, pending }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish this quiz?</DialogTitle>
        </DialogHeader>
        <p className="text-[14px] text-muted-foreground">
          Published questions can't be edited. You can start live games from it right away.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReviewStage({ quiz, questions, generated, onSaved, onPublished, onRegenerate, readOnly, onDirtyChange }) {
  const [draft, setDraft] = useState(questions);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const listRef = useRef(null);

  useEffect(() => { setDraft(questions); setDirty(false); }, [questions]);
  useEffect(() => onDirtyChange?.(dirty), [dirty]);

  const updateAt = (index, next) => {
    setDraft((d) => d.map((x, i) => (i === index ? next : x)));
    setDirty(true);
  };
  const move = (index, dir) => {
    setDraft((d) => {
      const next = [...d];
      const [item] = next.splice(index, 1);
      next.splice(index + dir, 0, item);
      return next;
    });
    setDirty(true);
  };
  const remove = (index) => {
    const removed = draft[index];
    setDraft((d) => d.filter((_, i) => i !== index));
    setDirty(true);
    toast('Question deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          setDraft((d) => {
            const next = [...d];
            next.splice(index, 0, removed);
            return next;
          });
        },
      },
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api('putQuestions', { quizId: quiz.id }, { body: { questions: draft } });
      onSaved(res.questions);
      setDirty(false);
    } catch (e) {
      setError(e);
      if (e.field) {
        const m = /questions\[(\d+)\]/.exec(e.field);
        if (m) {
          const el = listRef.current?.querySelector(`[data-question="${m[1]}"]`);
          el?.scrollIntoView({ block: 'center' });
          el?.querySelector('textarea,input')?.focus();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await api('publishQuiz', { quizId: quiz.id }, { body: {} });
      setConfirm(false);
      onPublished();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  const publishButton = (
    <Button disabled={dirty || readOnly} onClick={() => setConfirm(true)}>
      <Send className="size-4" aria-hidden="true" /> Publish
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Review questions</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {plural(draft.length, 'question', 'questions')} · {dirty ? 'unsaved changes' : 'saved'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRegenerate}>
            <RotateCcw className="size-4" aria-hidden="true" /> Regenerate
          </Button>
          <Button variant="secondary" onClick={save} disabled={!dirty || saving || readOnly}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Save changes
          </Button>
          {dirty ? (
            <Tooltip>
              <TooltipTrigger asChild><span>{publishButton}</span></TooltipTrigger>
              <TooltipContent>Save your changes. Publishing needs a validated question set.</TooltipContent>
            </Tooltip>
          ) : (
            publishButton
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border bg-destructive-muted p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-[14px]">{errorMessage(error)}</p>
        </div>
      )}

      <div ref={listRef} className="space-y-4">
        {draft.map((q, i) => (
          <QuestionEditor
            key={i}
            q={q}
            index={i}
            total={draft.length}
            generated={generated}
            onChange={(next) => updateAt(i, next)}
            onMove={move}
            onDelete={remove}
          />
        ))}
      </div>

      {!readOnly && draft.length < 20 && (
        <Button variant="ghost" onClick={() => { setDraft((d) => [...d, BLANK(generated)]); setDirty(true); }}>
          <Plus className="size-4" aria-hidden="true" /> Add question
        </Button>
      )}

      <PublishDialog open={confirm} onOpenChange={setConfirm} onConfirm={publish} pending={publishing} />
    </div>
  );
}
