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

export function PlayEntry() {
  const [code, setCode] = useState('');
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5 pb-[15vh]">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Join a game</h1>
      <div className="mt-6 space-y-2">
        <Label htmlFor="game-code">Game code</Label>
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
      <Button className="mt-4 h-14 w-full" disabled={code.length !== 6} onClick={() => navigate(`/play/${code}`)}>
        Continue
      </Button>
    </main>
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
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5 pb-[15vh]">
        <p className="text-[15px]">This game has ended or the code is wrong.</p>
        <Button variant="secondary" className="mt-4 h-14" onClick={() => navigate('/play')}>
          Enter another code
        </Button>
      </main>
    );
  }

  if (joinState === 'form') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5 pb-[15vh]">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
          Join <span className="tabular">{joinCode}</span>
        </h1>
        <div className="mt-6 space-y-2">
          <Label htmlFor="alias">Your name</Label>
          <Input
            id="alias"
            className="h-14 text-[18px]"
            maxLength={30}
            placeholder="e.g. Sam"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
          <p className="text-[13px] text-muted-foreground">Shown on the leaderboard.</p>
        </div>
        {joinError && <p className="mt-2 text-[13px] text-destructive">{joinError}</p>}
        <Button className="mt-4 h-14 w-full" disabled={!alias.trim() || pending} onClick={join}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Join game
        </Button>
      </main>
    );
  }

  const view = room ?? snapshot;
  if (!view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] items-center justify-center px-5">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Connecting" />
      </main>
    );
  }

  const open = view.status === 'question_open';
  const remaining = view.deadlineMs ? Math.max(0, Math.ceil((view.deadlineMs - clock.now()) / 1000)) : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-8">
      <TimerBar deadlineMs={open ? view.deadlineMs : null} now={clock.now} active={open} />
      {!connected && (
        <div className="fixed inset-x-0 top-2 z-50 flex h-10 items-center justify-center gap-2 bg-muted text-[14px]">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Reconnecting…
        </div>
      )}

      {view.status === 'lobby' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <CircleCheck className="size-10 text-success" aria-hidden="true" />
          <h1 className="text-[22px] font-semibold">You're in, {view.you?.alias ?? 'player'}.</h1>
          <p className="text-[15px] text-muted-foreground">Watch the main screen. The game starts soon.</p>
          <p className="text-[13px] text-muted-foreground">{plural(view.players.length, 'player', 'players')} joined</p>
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
    </div>
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
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 pt-16 text-center">
        {noAnswer ? (
          <>
            <Clock className="size-12 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-[24px] font-semibold">No answer</h1>
          </>
        ) : correct ? (
          <>
            <CircleCheck className="size-12 text-success" aria-hidden="true" />
            <h1 className="text-[24px] font-semibold">Correct</h1>
            <p className="tabular text-[17px]">+{result.score} points</p>
          </>
        ) : (
          <>
            <CircleX className="size-12 text-destructive" aria-hidden="true" />
            <h1 className="text-[24px] font-semibold">Not this time</h1>
            <p className="text-[15px] text-muted-foreground">
              The answer was {question.options[snapshot.correctIndex]}
            </p>
          </>
        )}
        <p className="tabular mt-4 text-[15px]">
          You're {rank >= 0 ? rank + 1 : '–'} of {leaderboard.length} · {you?.score ?? 0} points
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 pt-14">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] text-muted-foreground">Question {questionPosition + 1} of {questionCount}</p>
        <p className="tabular text-[15px]">{remaining}</p>
      </div>
      <h1 className="mt-4 text-[20px] font-semibold">{question.text}</h1>
      <div className="mt-6 space-y-3">
        {question.options.map((opt, i) => {
          const chosen = answer === i;
          const sending = chosen && !locked;
          return (
            <button
              key={i}
              disabled={answer !== null}
              onClick={() => onPick(i)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-4 text-left disabled:cursor-default ${
                chosen && locked ? 'border-primary bg-primary/5' : chosen ? 'border-primary' : ''
              } ${answer !== null && !chosen ? 'opacity-50' : ''}`}
            >
              <OptionShape index={i} size={24} />
              <span className="flex-1 text-[17px] font-medium">{opt}</span>
              {sending && (
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending…
                </span>
              )}
              {chosen && locked && (
                <span className="flex items-center gap-1.5 text-[13px]">
                  <Lock className="size-4" aria-hidden="true" /> Answer locked
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
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <p className="text-[15px] text-muted-foreground">Final rank</p>
      <p className="tabular text-[64px] font-bold leading-none">{rank >= 0 ? rank + 1 : '–'}</p>
      <p className="text-[15px] text-muted-foreground">of {plural(leaderboard.length, 'player', 'players')}</p>
      <p className="tabular mt-2 text-[17px]">{you?.score ?? 0} points</p>
      <Button variant="secondary" className="mt-6 h-14" onClick={() => navigate('/play')}>
        Join another game
      </Button>
    </div>
  );
}
