import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, Loader2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { relativeTime } from '@/lib/format';
import { navigate } from '@/components/app-shell';
import TopBar from '@/components/views/top-bar';

function CreateQuizDialog({ open, onOpenChange }) {
  const [fields, setFields] = useState({ title: '', audience: '', learningGoal: '' });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    setPending(true);
    setErrors({});
    try {
      const { quiz } = await api('createQuiz', {}, { body: fields });
      navigate(`/host/quiz/${quiz.id}`);
    } catch (e) {
      if (e.field) setErrors({ [e.field]: e.message ?? 'Invalid value.' });
      else setErrors({ form: errorMessage(e) });
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create quiz</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cq-title">Title</Label>
            <Input id="cq-title" value={fields.title} onChange={set('title')} />
            {errors.title && <p className="text-[13px] text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cq-audience">Audience</Label>
            <Input id="cq-audience" placeholder="e.g. New support hires" value={fields.audience} onChange={set('audience')} />
            {errors.audience && <p className="text-[13px] text-destructive">{errors.audience}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cq-goal">Learning goal</Label>
            <Textarea id="cq-goal" rows={3} placeholder="What should players know by the end?" value={fields.learningGoal} onChange={set('learningGoal')} />
            {errors.learningGoal && <p className="text-[13px] text-destructive">{errors.learningGoal}</p>}
          </div>
          {errors.form && <p className="text-[13px] text-destructive">{errors.form}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Creating…' : 'Create quiz'}
          </Button>
        </DialogFooter>
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

  return (
    <div>
      <TopBar />
      <main className="mx-auto max-w-[960px] px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Quizzes</h1>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" /> Create quiz
          </Button>
        </div>
        <div className="rounded-lg border">
          {state.loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="flex h-16 items-center px-4">
                <Skeleton className="h-5 w-1/2" />
              </div>
            ))
          ) : state.error ? (
            <div className="flex h-32 flex-col items-center justify-center gap-3">
              <p className="text-[14px] text-muted-foreground">{state.error}</p>
              <Button variant="secondary" onClick={load}>Try again</Button>
            </div>
          ) : state.quizzes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <p className="text-[15px]">No quizzes yet.</p>
              <p className="text-[14px] text-muted-foreground">
                Start from a website, a text document, pasted notes, or a short brief.
              </p>
              <Button className="mt-2" onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden="true" /> Create quiz
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {state.quizzes.map((q) => (
                <li key={q.id}>
                  <button
                    onClick={() => navigate(`/host/quiz/${q.id}`)}
                    className="flex h-16 w-full items-center gap-4 px-4 text-left hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{q.title}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {q.audience} · {q.learningGoal}
                      </span>
                    </span>
                    <Badge variant={q.status === 'published' ? 'default' : 'secondary'}>
                      {q.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                    <span className="hidden text-[13px] text-muted-foreground sm:inline">
                      Updated {relativeTime(q.updatedAt)}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <CreateQuizDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
