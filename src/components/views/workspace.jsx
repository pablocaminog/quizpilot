import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { formatCaptured, formatCount } from '@/lib/format';
import TopBar from '@/components/views/top-bar';
import SourceStage from '@/components/views/source-stage';
import DraftStage from '@/components/views/draft-stage';
import ReviewStage from '@/components/views/review-stage';
import PublishStage from '@/components/views/publish-stage';
import { Circle, CircleCheck, CircleDot, Lock } from 'lucide-react';

const STEPS = ['Source', 'Draft', 'Review', 'Publish'];

function subline(step, { source, questions, quiz, dirty }) {
  switch (step) {
    case 0:
      if (!source) return 'Not selected';
      return source.kind === 'url'
        ? `${source.label} · captured ${formatCaptured(source.capturedAt)}`
        : `${source.label} · ${formatCount(source.charCount ?? 0)} characters`;
    case 1:
      return questions.length ? `${questions.length} questions proposed` : 'Not drafted';
    case 2:
      return questions.length ? `${questions.length} questions · ${dirty ? 'Unsaved changes' : 'saved'}` : 'No questions';
    case 3:
      return quiz.status === 'published' ? 'Published' : 'Draft';
    default:
      return '';
  }
}

export default function Workspace({ quizId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [reviewDirty, setReviewDirty] = useState(false);

  const load = useCallback(() => {
    api('getQuiz', { quizId })
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [quizId]);
  useEffect(load, [load]);
  useEffect(() => setReviewDirty(false), [data?.questions]);

  if (error) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-[760px] px-4 py-16 text-center">
          <p className="text-[15px] text-muted-foreground">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => { setError(null); load(); }}>Try again</Button>
        </main>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <TopBar />
        <main className="mx-auto max-w-[760px] px-4 py-10">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-64 w-full" />
        </main>
      </div>
    );
  }

  const { quiz, source, questions } = data;
  const published = quiz.status === 'published';
  const generated = source?.kind === 'generate';
  const unlocked = [true, !!source, questions.length > 0, questions.length > 0];

  const reload = (advance) => {
    load();
    if (advance) setStep(1);
  };

  const nav = (vertical) => (
    <nav aria-label="Quiz steps" className={vertical ? '' : 'mb-6'}>
      <ol className={vertical ? 'space-y-1' : 'flex gap-1 overflow-x-auto'}>
        {STEPS.map((name, i) => {
          const open = unlocked[i];
          const current = step === i;
          const Icon = current ? CircleDot : open ? (i < step || (i === 0 && source) || (i === 3 && published) ? CircleCheck : Circle) : Lock;
          return (
            <li key={name}>
              <button
                onClick={() => open && setStep(i)}
                disabled={!open}
                aria-current={current ? 'step' : undefined}
                className={`flex min-h-14 w-full items-center gap-3 rounded-md px-3 text-left disabled:opacity-60 ${current ? 'bg-muted' : ''} ${vertical ? '' : 'min-w-40'}`}
              >
                <Icon className={`size-5 shrink-0 ${current ? 'text-primary' : Icon === CircleCheck ? 'text-success' : 'text-muted-foreground'}`} aria-hidden="true" />
                <span>
                  <span className="block text-[14px] font-medium">{name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {subline(i, { source, questions, quiz, dirty: reviewDirty })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const notice = published && step < 3 && (
    <p className="mb-4 text-[14px] text-muted-foreground">
      Published quizzes can't be edited. Start a game, or create a new quiz to change questions.
    </p>
  );

  const pane = (
    <div>
      {notice}
      {step === 0 && <SourceStage quiz={quiz} source={source} onSaved={reload} readOnly={published} />}
      {step === 1 && (
        <DraftStage
          quiz={quiz}
          source={source}
          onProposed={() => load()}
          onReview={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <ReviewStage
          quiz={quiz}
          questions={questions}
          generated={generated}
          onSaved={() => { load(); setReviewDirty(false); }}
          onDirtyChange={setReviewDirty}
          onPublished={() => { load(); setStep(3); }}
          onRegenerate={() => setStep(1)}
          readOnly={published}
        />
      )}
      {step === 3 && (
        <PublishStage quiz={quiz} source={source} questionCount={questions.length} onPublished={load} />
      )}
    </div>
  );

  return (
    <div>
      <TopBar quiz={quiz} />
      <main className="mx-auto max-w-[1200px] px-4">
        <div className="hidden min-h-[calc(100dvh-56px)] lg:grid lg:grid-cols-[248px_1fr]">
          <aside className="border-r py-8 pr-6">
            <div className="sticky top-22">{nav(true)}</div>
          </aside>
          <div className="max-w-[760px] py-8 pl-10">{pane}</div>
        </div>
        <div className="py-6 lg:hidden">
          {nav(false)}
          {pane}
        </div>
      </main>
    </div>
  );
}
