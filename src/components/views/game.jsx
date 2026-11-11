import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, CircleCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRoom } from '@/lib/use-room';
import TimerBar, { useServerClock } from '@/components/timer-bar';
import OptionShape from '@/components/option-shape';
import { navigate } from '@/components/app-shell';
import { plural } from '@/lib/format';
import { errorMessage } from '@/lib/messages';
import { WS_CLIENT, WS_SERVER } from '@/shared/protocol.js';

function useQr(url) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: 'svg', margin: 0 }).then((svg) => {
      if (live) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    });
    return () => { live = false; };
  }, [url]);
  return src;
}

export default function Game({ joinCode }) {
  const clock = useServerClock();
  const [answered, setAnswered] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [, force] = useState(0);
  const { snapshot, room, connected, send } = useRoom(`/ws/games/${joinCode}/host`, {
    onEvent: (e) => {
      if (e.type === WS_SERVER.questionOpen) {
        clock.setServerNow(e.serverNowMs);
        setAnswered(0);
      } else if (e.type === WS_SERVER.answerCount) {
        setAnswered(e.answered);
      } else if (e.type === WS_SERVER.snapshot) {
        clock.setServerNow(e.snapshot.serverNowMs);
        setAnswered(e.snapshot.answeredCount);
      } else if (e.type === WS_SERVER.error) {
        toast.error(errorMessage({ error: e.code }));
      }
    },
  });

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Space/Enter triggers the primary action outside of controls.
  const primaryRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== 'Enter') return;
      const t = e.target;
      if (t.closest('button,input,textarea,select,a,[role="dialog"]')) return;
      e.preventDefault();
      primaryRef.current?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const view = room ?? snapshot;
  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Connecting" />
      </div>
    );
  }

  const { status, questionPosition, questionCount, question, deadlineMs, players } = view;
  const open = status === 'question_open';
  const remaining = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - clock.now()) / 1000)) : null;

  const primary = (() => {
    if (status === 'lobby')
      return { label: 'Start game', send: WS_CLIENT.start, disabled: players.length === 0, tip: 'Waiting for players' };
    if (status === 'question_open') return { label: 'Close question', send: WS_CLIENT.closeQuestion };
    if (status === 'question_closed')
      return questionPosition + 1 >= questionCount
        ? { label: 'Show final results', send: WS_CLIENT.finish }
        : { label: 'Next question', send: WS_CLIENT.nextQuestion };
    return { label: 'Back to quiz', nav: `/host/quiz/${view.quizId}` };
  })();

  const leaderboard = view.leaderboard ?? players;
  const results = view.results ?? [];
  const counts = question?.options.map((_, i) => results.filter((r) => r.selectedIndex === i).length) ?? [];
  const deltas = Object.fromEntries(results.map((r) => [r.playerId, r.score]));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TimerBar deadlineMs={open ? deadlineMs : null} now={clock.now} active={open} />

      <main className="flex flex-1 flex-col px-[4vw] pb-24 pt-[6vh]">
        {status === 'lobby' && <Lobby joinCode={joinCode} players={players} />}
        {(open || status === 'question_closed') && question && (
          <QuestionStage
            open={open}
            k={questionPosition + 1}
            n={questionCount}
            question={question}
            remaining={remaining}
            answered={answered ?? view.answeredCount}
            total={players.length}
            counts={counts}
            correctIndex={status === 'question_closed' ? view.correctIndex : null}
            leaderboard={leaderboard}
            deltas={deltas}
            showLeaderboard={status === 'question_closed'}
          />
        )}
        {status === 'finished' && <Finished leaderboard={leaderboard} questionCount={questionCount} />}
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex h-20 items-center justify-between border-t bg-background px-8">
        <div className="flex items-center gap-3 text-[18px]">
          <span className="tabular">Room {joinCode} · {plural(players.length, 'player', 'players')}</span>
          <span className={`flex items-center gap-1.5 text-[13px] ${connected ? 'text-success' : 'text-muted-foreground'}`}>
            {connected ? (
              <>
                <span className="size-2 rounded-full bg-success" /> Live
              </>
            ) : (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Reconnecting…
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status !== 'finished' && (
            <Button variant="secondary" onClick={() => setConfirmEnd(true)}>
              End game
            </Button>
          )}
          {primary.tip && primary.disabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <PrimaryButton ref={primaryRef} primary={primary} send={send} disabled />
                </span>
              </TooltipTrigger>
              <TooltipContent>{primary.tip}</TooltipContent>
            </Tooltip>
          ) : (
            <PrimaryButton ref={primaryRef} primary={primary} send={send} />
          )}
          <kbd className="rounded border px-1.5 py-0.5 text-[13px] text-muted-foreground">Space</kbd>
        </div>
      </footer>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this game?</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-muted-foreground">The game finishes for every player and results are saved.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Cancel</Button>
            <Button onClick={() => { send({ type: WS_CLIENT.finish }); setConfirmEnd(false); }}>End game</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PrimaryButton = forwardRef(function PrimaryButton({ primary, send, disabled }, ref) {
  return (
    <Button
      ref={ref}
      className="h-12 px-6 text-[18px]"
      disabled={disabled}
      onClick={() => (primary.nav ? navigate(primary.nav) : send({ type: primary.send }))}
    >
      {primary.label}
    </Button>
  );
});

function Lobby({ joinCode, players }) {
  const url = `${location.origin}/play/${joinCode}`;
  const qr = useQr(url);
  const shown = players.slice(0, 36);
  const extra = players.length - shown.length;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
      <p className="text-[3vw] font-medium">Join at {location.host}/play</p>
      <div className="flex items-center gap-[3vw]">
        {qr && <img src={qr} alt={`QR code for ${url}`} className="h-[22vh] w-[22vh]" aria-label={`QR code for ${url}`} />}
        <div className="tabular text-[clamp(6rem,13vw,14rem)] font-bold leading-none tracking-[0.06em]">{joinCode}</div>
      </div>
      {players.length === 0 ? (
        <p className="text-[2vw] text-muted-foreground">Waiting for players…</p>
      ) : (
        <>
          <p className="text-[2.5vw] font-semibold">{plural(players.length, 'player', 'players')}</p>
          <ul className="flex max-w-[70vw] flex-wrap justify-center gap-[0.8vw]">
            {[...shown].reverse().map((p) => (
              <li key={p.playerId} className="rounded-md bg-muted px-[1vw] py-[0.4vw] text-[1.4vw]">
                {p.alias}
              </li>
            ))}
            {extra > 0 && <li className="rounded-md bg-muted px-[1vw] py-[0.4vw] text-[1.4vw]">+{extra} more</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function QuestionStage({ open, k, n, question, remaining, answered, total, counts, correctIndex, leaderboard, deltas, showLeaderboard }) {
  return (
    <div className="flex flex-1 gap-[3vw]">
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-[1.6vw] text-muted-foreground">Question {k} of {n}</p>
          {open && (
            <div className="text-right">
              <div className={`tabular text-[6vw] font-bold leading-none ${remaining <= 5 ? 'text-destructive' : ''}`}>{remaining}</div>
              <div className="tabular text-[1.4vw] text-muted-foreground">{answered} / {total} answered</div>
            </div>
          )}
        </div>
        <h1 className="mt-[2vh] max-w-[28ch] text-[3.4vw] font-semibold text-balance">{question.text}</h1>
        <div className="mt-[4vh] grid grid-cols-2 gap-[1.5vw]">
          {question.options.map((opt, i) => {
            const isCorrect = correctIndex === i;
            const dim = correctIndex !== null && !isCorrect;
            return (
              <div
                key={i}
                className={`flex min-h-[18vh] flex-col rounded-xl border-2 p-[2vw] ${dim ? 'opacity-45' : ''}`}
                style={isCorrect ? { background: 'var(--success-muted)', borderColor: 'var(--success)', borderWidth: 3 } : {}}
              >
                <div className="flex items-center gap-[1vw]">
                  <OptionShape index={i} size={undefined} className="h-[3vw] w-[3vw]" />
                  <span className="text-[2.4vw] font-medium">{opt}</span>
                </div>
                {isCorrect && (
                  <div className="mt-[0.6vh] flex items-center gap-[0.5vw] text-success">
                    <CircleCheck className="h-[3vw] w-[3vw]" aria-hidden="true" />
                    <span className="text-[1.4vw] font-semibold">Correct answer</span>
                  </div>
                )}
                {correctIndex !== null && (
                  <div className="mt-auto flex items-center gap-[1vw] pt-[1vh]">
                    <div className="h-[1.2vh] flex-1 rounded bg-foreground/15">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${totalPick(counts) ? (counts[i] / totalPick(counts)) * 100 : 0}%`,
                          background: isCorrect ? 'var(--success)' : 'var(--foreground)',
                          opacity: isCorrect ? 1 : 0.4,
                        }}
                      />
                    </div>
                    <span className="tabular text-[1.6vw]">{counts[i] ?? 0}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showLeaderboard && (
        <aside className="w-[26vw] shrink-0 max-[1400px]:w-full">
          <h2 className="text-[1.8vw] font-semibold">Leaderboard</h2>
          <ol className="mt-[2vh] space-y-[1vh]">
            {leaderboard.slice(0, 5).map((p, i) => (
              <li key={p.playerId} className="flex items-baseline gap-[1vw]">
                <span className="tabular w-[2vw] text-[1.6vw] text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate text-[2vw] font-medium">{p.alias}</span>
                {deltas[p.playerId] > 0 && <span className="tabular text-[1.2vw] text-success">+{deltas[p.playerId]}</span>}
                <span className="tabular text-[2vw] font-semibold">{p.score}</span>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}
const totalPick = (counts) => counts.reduce((a, b) => a + b, 0);

function Finished({ leaderboard, questionCount }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh]">
      <h1 className="text-[3vw] font-semibold">Final results</h1>
      <ol className="w-[60vw] space-y-[1.2vh]">
        {leaderboard.slice(0, 10).map((p, i) => (
          <li key={p.playerId} className={`flex items-baseline gap-[2vw] ${i < 3 ? 'text-[3vw]' : 'text-[2vw]'}`}>
            <span className="tabular w-[3vw] text-muted-foreground">{i + 1}</span>
            <span className="flex-1 truncate font-medium">{p.alias}</span>
            <span className="tabular font-semibold">{p.score}</span>
          </li>
        ))}
      </ol>
      <p className="text-[1.4vw] text-muted-foreground">
        {plural(leaderboard.length, 'player', 'players')} · {plural(questionCount, 'question', 'questions')}
      </p>
    </div>
  );
}
