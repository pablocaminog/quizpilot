import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuestionEditor from '@/components/views/question-editor';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { AlertCircle, Loader2, Plus, RotateCcw } from 'lucide-react';
import { StageHeading } from '@/components/stage';
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
        <p className="text-[15px] text-muted-foreground">Questions can't be edited after publishing.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="signal" onClick={onConfirm} disabled={pending}>
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
    <Button variant="signal" disabled={dirty || readOnly} onClick={() => setConfirm(true)}>
      Publish
    </Button>
  );

  return (
    <div>
      <StageHeading step title="Review" hint={`${plural(draft.length, 'question', 'questions')} · ${dirty ? 'unsaved' : 'saved'}`}>
        <Button variant="ghost" onClick={onRegenerate}>
          <RotateCcw className="size-4" aria-hidden="true" /> Regenerate
        </Button>
        <Button variant="secondary" onClick={save} disabled={!dirty || saving || readOnly}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Save
        </Button>
        {dirty ? (
          <Tooltip>
            <TooltipTrigger asChild><span tabIndex={0}>{publishButton}</span></TooltipTrigger>
            <TooltipContent>Save first.</TooltipContent>
          </Tooltip>
        ) : (
          publishButton
        )}
      </StageHeading>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive-muted px-5 py-3.5">
          <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-[14px]">{errorMessage(error)}</p>
        </div>
      )}

      <div ref={listRef} className="space-y-6">
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
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => { setDraft((d) => [...d, BLANK(generated)]); setDirty(true); }}>
            <Plus className="size-4" aria-hidden="true" /> Add question
          </Button>
        </div>
      )}

      <PublishDialog open={confirm} onOpenChange={setConfirm} onConfirm={publish} pending={publishing} />
    </div>
  );
}
