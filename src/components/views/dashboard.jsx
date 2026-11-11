import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { relativeTime } from '@/lib/format';
import { navigate } from '@/components/app-shell';
import TopBar from '@/components/views/top-bar';
import Stage, { StageHeading } from '@/components/stage';
import { SpecTag } from '@/components/spec-tag';

function Field({ id, label, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

function CreateQuizDialog({ open, onOpenChange }) {
  const [fields, setFields] = useState({ title: '', audience: '', learningGoal: '' });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e?.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const { quiz } = await api('createQuiz', {}, { body: fields });
      navigate(`/host/quiz/${quiz.id}`);
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message ?? 'Invalid value.' });
      else setErrors({ form: errorMessage(err) });
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New quiz</DialogTitle>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <Field id="cq-title" label="Title" error={errors.title}>
            <Input id="cq-title" value={fields.title} onChange={set('title')} autoFocus />
          </Field>
          <Field id="cq-audience" label="Audience" error={errors.audience}>
            <Input id="cq-audience" placeholder="New support hires" value={fields.audience} onChange={set('audience')} />
          </Field>
          <Field id="cq-goal" label="Goal" error={errors.learningGoal}>
            <Textarea id="cq-goal" rows={3} placeholder="What should players know?" value={fields.learningGoal} onChange={set('learningGoal')} />
          </Field>
          {errors.form && <p className="text-[13px] text-destructive">{errors.form}</p>}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, error: null, quizzes: [] });
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api('listQuizzes')
      .then((d) => setState({ loading: false, error: null, quizzes: d.quizzes }))
      .catch((e) => setState({ loading: false, error: errorMessage(e), quizzes: [] }));
  }, []);
  useEffect(load, [load]);

  const empty = !state.loading && !state.error && state.quizzes.length === 0;
  const newQuiz = <Button onClick={() => setCreating(true)}>New quiz</Button>;

  return (
    <div>
      <TopBar />
      <Stage>
        {empty ? (
          <StageHeading title="No quizzes yet" hint="Start from a page, a document, or a brief.">{newQuiz}</StageHeading>
        ) : (
          <>
            <StageHeading title="Quizzes">{newQuiz}</StageHeading>
            <SpecTag as="div">
              {state.loading ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="flex h-[68px] items-center px-5">
                    <Skeleton className="h-4 w-1/2 bg-secondary" />
                  </div>
                ))
              ) : state.error ? (
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <p className="text-[15px] text-muted-foreground">Couldn't load quizzes.</p>
                  <Button variant="secondary" onClick={load}>Retry</Button>
                </div>
              ) : (
                state.quizzes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => navigate(`/host/quiz/${q.id}`)}
                    className="flex min-h-[68px] w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-background"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{q.title}</span>
                      <span className="type-small block truncate">
                        {q.audience} · updated {relativeTime(q.updatedAt)}
                      </span>
                    </span>
                    <Badge variant={q.status === 'published' ? 'default' : 'secondary'}>
                      {q.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))
              )}
            </SpecTag>
          </>
        )}
      </Stage>
      <CreateQuizDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
