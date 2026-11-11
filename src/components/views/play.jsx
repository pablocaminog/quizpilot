import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CircleCheck, CircleX, Clock, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { plural } from '@/lib/format';
import { useRoom } from '@/lib/use-room';
import TimerBar, { useServerClock } from '@/components/timer-bar';
import OptionShape from '@/components/option-shape';
import { navigate } from '@/components/app-shell';
import { WS_CLIENT, WS_SERVER } from '@/shared/protocol.js';
import { SpecRow, SpecTag } from '@/components/spec-tag';

export function PlayEntry() {
  const [code, setCode] = useState('');
  return (
    <PlayStage>
      <h1 className="type-step text-center">Join a game</h1>
      <div className="mt-10 space-y-2">
        <Label htmlFor="game-code">Code</Label>
        <Input
          id="game-code"
          value={code}
          maxLength={6}
          inputMode="text"
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          className="tabular h-16 text-center text-[28px] tracking-[0.2em]"
        />
      </div>
      <Button size="lg" className="mt-4 w-full" disabled={code.length !== 6} onClick={() => navigate(`/play/${code}`)}>
        Continue
      </Button>
    </PlayStage>
  );
}

export default function Play({ joinCode }) {
  const [joinState, setJoinState] = useState('checking'); // checking | form | joined | notfound
  const [alias, setAlias] = useState('');
  const [pending, setPending] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [answer, setAnswer] = useState(null); // selectedIndex while sending / locked
  const [answeredEvent, setAnsweredEvent] = useState(null);
  const [lastClosed, setLastClosed] = useState(null);
  const [finished, setFinished] = useState(null);
  const clock = useServerClock();

  const { snapshot, room, connected, denied, send } = useRoom(`/ws/games/${joinCode}`, {
    onUnauthorized: () => setJoinState((s) => (s === 'joined' ? s : 'form')),
    onEvent: (e) => {
      if (e.type === WS_SERVER.snapshot) {
        clock.setServerNow(e.snapshot.serverNowMs);
        if (e.snapshot.you?.currentAnswer) {
          setAnswer(e.snapshot.you.currentAnswer.selectedIndex);
          setAnsweredEvent(true);
        }
        if (e.snapshot.status === 'question_closed') setLastClosed(e.snapshot);
        if (e.snapshot.status === 'finished') setFinished(e.snapshot.leaderboard);
      } else if (e.type === WS_SERVER.questionOpen) {
        clock.setServerNow(e.serverNowMs);
        setAnswer(null);
        setAnsweredEvent(null);
        setLastClosed(null);
      } else if (e.type === WS_SERVER.answerAccepted) {
        setAnsweredEvent(true);
      } else if (e.type === WS_SERVER.questionClosed) {
        setLastClosed(e);
      } else if (e.type === WS_SERVER.gameFinished) {
        setFinished(e.leaderboard);
      } else if (e.type === WS_SERVER.error) {
        if (e.code === 'ANSWER_TOO_LATE' || e.code === 'ANSWER_DUPLICATE') {
          setAnsweredEvent(true); // keep locked
        }
        toast.error(errorMessage({ error: e.code }));
      }
    },
  });

  useEffect(() => {
    if (snapshot) setJoinState('joined');
    else if (denied) setJoinState('form');
  }, [snapshot, denied]);

  const join = async () => {
    setPending(true);
    setJoinError(null);
    try {
      await api('joinGame', { joinCode }, { body: { alias } });
      location.reload();
    } catch (e) {
      if (e.error === 'GAME_NOT_FOUND') setJoinState('notfound');
      else setJoinError(errorMessage(e));
      setPending(false);
    }
  };

  if (joinState === 'notfound') {
    return (
      <PlayStage className="text-center">
        <p className="type-title">This game has ended or the code is wrong.</p>
        <Button variant="secondary" size="lg" className="mt-8" onClick={() => navigate('/play')}>
          Enter another code
        </Button>
      </PlayStage>
    );
  }

  if (joinState === 'form') {
    return (
      <PlayStage>
        <h1 className="tabular text-center text-[40px] leading-none font-semibold tracking-[0.06em]">{joinCode}</h1>
        <form className="mt-10" onSubmit={(e) => { e.preventDefault(); if (alias.trim() && !pending) join(); }}>
          <div className="space-y-2">
            <Label htmlFor="alias">Name</Label>
            <Input
              id="alias"
              className="h-14 text-[18px]"
              maxLength={30}
              placeholder="Sam"
              autoComplete="nickname"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>
          {joinError && <p className="mt-2 text-[13px] text-destructive">{joinError}</p>}
          <Button type="submit" variant="signal" size="lg" className="mt-4 w-full" disabled={!alias.trim() || pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Join game
          </Button>
        </form>
      </PlayStage>
    );
  }

  const view = room ?? snapshot;
  if (!view) {
    return (
      <PlayStage className="flex justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Connecting" />
      </PlayStage>
    );
  }

  const open = view.status === 'question_open';
  const remaining = view.deadlineMs ? Math.max(0, Math.ceil((view.deadlineMs - clock.now()) / 1000)) : null;

  return (
    <PlayStage>
      <TimerBar deadlineMs={open ? view.deadlineMs : null} now={clock.now} active={open} />
      {!connected && (
        <div className="fixed inset-x-0 top-1 z-50 flex h-9 items-center justify-center gap-2 bg-secondary text-[13px]">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Reconnecting…
        </div>
      )}

      {view.status === 'lobby' && (
        <div className="flex flex-col items-center text-center">
          <CircleCheck className="size-8 text-success" aria-hidden="true" />
          <h1 className="mt-4 text-[22px] font-medium tracking-[-0.01em]">You're in, {view.you?.alias ?? 'player'}.</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">Watch the screen.</p>
        </div>
      )}

      {(open || view.status === 'question_closed') && view.question && (
        <QuestionPlay
          snapshot={{ ...view, you: view.you ?? snapshot?.you }}
          closed={lastClosed}
          remaining={remaining}
          answer={answer}
          locked={!!answeredEvent}
          onPick={(i) => {
            if (answeredEvent || answer !== null) return;
            setAnswer(i);
            send({ type: WS_CLIENT.answer, optionIndex: i });
          }}
        />
      )}

      {view.status === 'finished' && (
        <FinishedPlayer leaderboard={finished ?? view.leaderboard ?? []} you={view.you ?? snapshot?.you} />
      )}
    </PlayStage>
  );
}

function PlayStage({ className, children }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-6 py-14" style={{ paddingBottom: 'max(3.5rem, env(safe-area-inset-bottom))' }}>
      <div className={`my-auto w-full max-w-[480px] ${className ?? ''}`}>{children}</div>
    </main>
  );
}

function QuestionPlay({ snapshot, closed, remaining, answer, locked, onPick }) {
  const { question, questionPosition, questionCount, you } = snapshot;
  const isClosed = snapshot.status === 'question_closed';
  const result = isClosed ? (closed?.results ?? snapshot.results ?? []).find((r) => r.playerId === you?.playerId) ?? you?.lastResult : null;
  const leaderboard = closed?.leaderboard ?? snapshot.leaderboard ?? snapshot.players;
  const rank = leaderboard.findIndex((p) => p.playerId === you?.playerId);

  if (isClosed) {
    const noAnswer = !result || result.selectedIndex == null;
    const correct = result?.correct;
    const Icon = noAnswer ? Clock : correct ? CircleCheck : CircleX;
    return (
      <div className="flex flex-col items-center text-center">
        <Icon className={`size-10 ${noAnswer ? 'text-muted-foreground' : correct ? 'text-success' : 'text-destructive'}`} aria-hidden="true" />
        <h1 className="mt-4 text-[28px] font-medium tracking-[-0.02em]">{noAnswer ? 'No answer' : correct ? 'Correct' : 'Not this time'}</h1>
        {!noAnswer && !correct && (
          <p className="mt-1.5 text-[15px] text-muted-foreground">The answer was {question.options[snapshot.correctIndex]}</p>
        )}
        <SpecTag className="mt-8 w-full text-left">
          <SpecRow label="Points"><span className="tabular">+{result?.score ?? 0}</span></SpecRow>
          <SpecRow label="Rank"><span className="tabular">{rank >= 0 ? rank + 1 : '–'} of {leaderboard.length}</span></SpecRow>
          <SpecRow label="Total"><span className="tabular">{you?.score ?? 0}</span></SpecRow>
        </SpecTag>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="tabular type-small">Q{questionPosition + 1} / {questionCount}</p>
        <p className={`tabular text-[17px] font-semibold ${remaining <= 5 ? 'text-destructive' : ''}`}>{remaining}</p>
      </div>
      <h1 className="mt-4 text-[20px] leading-snug font-medium tracking-[-0.01em]">{question.text}</h1>
      <div className="mt-8 space-y-3">
        {question.options.map((opt, i) => {
          const chosen = answer === i;
          const sending = chosen && !locked;
          return (
            <button
              key={i}
              disabled={answer !== null}
              onClick={() => onPick(i)}
              className={`flex min-h-16 w-full items-center gap-3.5 rounded-md border bg-card px-4 py-3 text-left transition-[opacity,border-color] disabled:cursor-default ${
                chosen ? 'border-signal shadow-[inset_0_0_0_1px_var(--signal)]' : 'active:border-foreground'
              } ${answer !== null && !chosen ? 'opacity-45' : ''}`}
            >
              <OptionShape index={i} size={18} className="shrink-0" />
              <span className="min-w-0 flex-1 text-[17px] font-medium">{opt}</span>
              {sending && (
                <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Sending…
                </span>
              )}
              {chosen && locked && (
                <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-signal">
                  <Lock className="size-3.5" aria-hidden="true" /> Locked
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FinishedPlayer({ leaderboard, you }) {
  const rank = leaderboard.findIndex((p) => p.playerId === you?.playerId);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="type-label">Final rank</p>
      <p className="tabular mt-3 text-[72px] leading-none font-semibold tracking-[-0.02em]">{rank >= 0 ? rank + 1 : '–'}</p>
      <p className="type-small mt-2">of {plural(leaderboard.length, 'player', 'players')}</p>
      <SpecTag className="mt-8 w-full text-left">
        <SpecRow label="Total"><span className="tabular">{you?.score ?? 0} points</span></SpecRow>
      </SpecTag>
      <Button variant="ghost" className="mt-6" onClick={() => navigate('/play')}>
        Join another game
      </Button>
    </div>
  );
}
