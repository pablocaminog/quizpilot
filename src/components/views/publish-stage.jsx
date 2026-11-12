import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { navigate } from '@/components/app-shell';
import { PublishDialog } from '@/components/views/review-stage';
import { Check, Copy, Loader2, Minus, Play } from 'lucide-react';
import { StageHeading } from '@/components/stage';
import { SpecRow, SpecTag } from '@/components/spec-tag';
import GameSettings from '@/components/views/game-settings';
import { plural } from '@/lib/format';
import { toast } from 'sonner';

function CheckRow({ label, done, children }) {
  return (
    <SpecRow label={label}>
      <span className="flex items-center gap-2">
        {done ? <Check className="size-4 text-success" aria-label="done" /> : <Minus className="size-4 text-muted-foreground" aria-label="missing" />}
        {children}
      </span>
    </SpecRow>
  );
}

export default function PublishStage({ quiz, source, questionCount, settings, onPublished }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  if (quiz.status === 'published') {
    const url = `${location.origin}${quiz.publishedUrl}`;
    const start = async () => {
      setStarting(true);
      try {
        const { game } = await api('createGame', { quizId: quiz.id }, { body: {} });
        navigate(`/game/${game.joinCode}`);
      } catch (e) {
        toast.error(errorMessage(e));
        setStarting(false);
      }
    };
    return (
      <div>
        <StageHeading step title="Ready to play" />
        <SpecTag>
          <SpecRow label="Link">
            <div className="flex items-center gap-2">
              <Input readOnly value={url} aria-label="Quiz URL" onFocus={(e) => e.target.select()} className="tabular" />
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(url);
                  setCopied(true);
                  toast('Link copied');
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                Copy
              </Button>
            </div>
          </SpecRow>
          <SpecRow label="Games"><span className="text-muted-foreground">Each game gets a new code.</span></SpecRow>
        </SpecTag>
        <div className="mt-8">
          <GameSettings quizId={quiz.id} settings={settings} />
        </div>
        <div className="mt-10 flex justify-center">
          <Button variant="signal" size="lg" onClick={start} disabled={starting}>
            {starting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            Start game
          </Button>
        </div>
      </div>
    );
  }

  const publish = async () => {
    setPending(true);
    try {
      await api('publishQuiz', { quizId: quiz.id }, { body: {} });
      setConfirm(false);
      onPublished();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const ready = !!source && questionCount >= 2;
  return (
    <div>
      <StageHeading step title="Publish" hint="Publishing locks the questions." />
      <SpecTag>
        <CheckRow label="Source" done={!!source}>{source ? source.label : 'Not selected'}</CheckRow>
        <CheckRow label="Questions" done={questionCount >= 2}>{plural(questionCount, 'question', 'questions')} saved</CheckRow>
        <CheckRow label="Provenance" done={questionCount >= 2}>Cited or marked AI-generated</CheckRow>
      </SpecTag>
      <div className="mt-8">
        <GameSettings quizId={quiz.id} settings={settings} />
      </div>
      <div className="mt-10 flex justify-center">
        <Button variant="signal" size="lg" onClick={() => setConfirm(true)} disabled={!ready}>
          Publish
        </Button>
      </div>
      <PublishDialog open={confirm} onOpenChange={setConfirm} onConfirm={publish} pending={pending} />
    </div>
  );
}
