import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check } from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import TopBar from '@/components/views/top-bar';
import Stage from '@/components/stage';
import SourceStage from '@/components/views/source-stage';
import DraftStage from '@/components/views/draft-stage';
import ReviewStage from '@/components/views/review-stage';
import PublishStage from '@/components/views/publish-stage';

const STEPS = ['Source', 'Draft', 'Review', 'Publish'];

function StepStrip({ step, setStep, unlocked, done }) {
  return (
    <nav aria-label="Quiz steps" className="mb-12 flex justify-center">
      <ol className="flex items-center gap-1 sm:gap-4">
        {STEPS.map((name, i) => {
          const current = step === i;
          return (
            <li key={name}>
              <button
                onClick={() => unlocked[i] && setStep(i)}
                disabled={!unlocked[i]}
                aria-disabled={!unlocked[i]}
                aria-current={current ? 'step' : undefined}
                className={`relative inline-flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors disabled:opacity-40 ${current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {name}
                {done[i] && !current && <Check className="size-3.5 text-success" aria-label="done" />}
                {current && <span className="absolute inset-x-3 bottom-1 h-0.5 bg-signal" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
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
        <Stage width={480} className="text-center">
          <p className="text-[15px] text-muted-foreground">{error}</p>
          <Button variant="secondary" className="mt-6" onClick={() => { setError(null); load(); }}>Try again</Button>
        </Stage>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <TopBar />
        <Stage>
          <Skeleton className="mx-auto h-8 w-48 bg-secondary" />
          <Skeleton className="mt-10 h-64 w-full bg-secondary" />
        </Stage>
      </div>
    );
  }

  const { quiz, source, questions } = data;
  const published = quiz.status === 'published';
  const generated = source?.kind === 'generate';
  const unlocked = [true, !!source, questions.length > 0, questions.length > 0];
  const done = [!!source, questions.length > 0, questions.length > 0 && !reviewDirty, published];

  const reload = (advance) => {
    load();
    if (advance) setStep(1);
  };

  return (
    <div>
      <TopBar quiz={quiz} />
      <Stage className={step === 1 ? 'flex flex-col' : undefined}>
        <StepStrip step={step} setStep={setStep} unlocked={unlocked} done={done} />
        {published && step < 3 && (
          <p className="type-small -mt-6 mb-10 text-center">Published quizzes can't be edited.</p>
        )}
        {step === 0 && <SourceStage quiz={quiz} source={source} onSaved={reload} readOnly={published} />}
        {step === 1 && (
          <DraftStage quiz={quiz} source={source} onProposed={() => load()} onReview={() => setStep(2)} />
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
          <PublishStage quiz={quiz} source={source} questionCount={questions.length} settings={quiz.settings} onPublished={load} />
        )}
      </Stage>
    </div>
  );
}
