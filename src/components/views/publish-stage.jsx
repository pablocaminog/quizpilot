import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { navigate } from '@/components/app-shell';
import { PublishDialog } from '@/components/views/review-stage';
import { Check, Circle, CircleCheck, Copy, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

function CheckRow({ done, children }) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <div className="flex items-center gap-2 text-[14px]">
      <Icon className={`size-5 ${done ? 'text-success' : 'text-muted-foreground'}`} aria-hidden="true" />
      {children}
    </div>
  );
}

export default function PublishStage({ quiz, source, questionCount, onPublished }) {
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
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Ready to play</h2>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={url} aria-label="Quiz URL" onFocus={(e) => e.target.select()} />
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
        <div>
          <Button className="h-12" onClick={start} disabled={starting}>
            {starting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            Start a live game
          </Button>
          <p className="mt-2 text-[13px] text-muted-foreground">Each game gets a new join code.</p>
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Publish</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Publishing locks the questions. Each live game uses this exact set.
        </p>
      </div>
      <div className="space-y-3">
        <CheckRow done={!!source}>Source selected</CheckRow>
        <CheckRow done={questionCount >= 2}>{questionCount} questions saved and validated</CheckRow>
        <CheckRow done={questionCount >= 2}>Every question cites the source or is marked AI-generated</CheckRow>
      </div>
      <Button onClick={() => setConfirm(true)} disabled={!source || questionCount < 2}>
        Publish
      </Button>
      <PublishDialog open={confirm} onOpenChange={setConfirm} onConfirm={publish} pending={pending} />
    </div>
  );
}
