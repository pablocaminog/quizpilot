import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Loader2 } from 'lucide-react';
import { SpecRow, SpecTag } from '@/components/spec-tag';
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
      return { label: 'Start', send: WS_CLIENT.start, disabled: players.length === 0, tip: 'Waiting for players', signal: true };
    if (status === 'question_open') return { label: 'Close question', send: WS_CLIENT.closeQuestion };
    if (status === 'question_closed')
      return questionPosition + 1 >= questionCount
        ? { label: 'Results', send: WS_CLIENT.finish }
        : { label: 'Next', send: WS_CLIENT.nextQuestion };
    return { label: 'Back to quiz', nav: `/host/quiz/${view.quizId}` };
  })();

  const leaderboard = view.leaderboard ?? players;
  const results = view.results ?? [];
  const counts = question?.options.map((_, i) => results.filter((r) => r.selectedIndex === i).length) ?? [];
  const deltas = Object.fromEntries(results.map((r) => [r.playerId, r.score]));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TimerBar deadlineMs={open && clock.now() >= (view.answersOpenAtMs ?? 0) ? deadlineMs : null} now={clock.now} active={open} />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-[4vw] pt-[5vh] pb-[calc(4rem+5vh)]">
        {status === 'lobby' && <Lobby joinCode={joinCode} players={players} />}
        {(open || status === 'question_closed') && question && (
          <QuestionStage
            open={open}
            ready={open && view.answersOpenAtMs != null && clock.now() < view.answersOpenAtMs}
            readySecondsLeft={view.answersOpenAtMs ? Math.max(0, Math.ceil((view.answersOpenAtMs - clock.now()) / 1000)) : 0}
            k={questionPosition + 1}
            n={questionCount}
            question={question}
            remaining={remaining}
            answered={answered ?? view.answeredCount}
            total={players.length}
            counts={counts}
            correctIndex={status === 'question_closed' ? view.correctIndex : null}
            leaderboard={leaderboard}
            showLeaderboard={status === 'question_closed' ? (view.settings?.showLeaderboard ?? true) : true}
            deltas={deltas}
            showLeaderboard={status === 'question_closed'}
          />
        )}
        {status === 'finished' && <Finished leaderboard={leaderboard} questionCount={questionCount} />}
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-between border-t bg-background px-8">
        <div className="flex items-center gap-4 text-[15px]">
          <span className="tabular">Room {joinCode} · {plural(players.length, 'player', 'players')}</span>
          <span className={`flex items-center gap-1.5 text-[13px] ${connected ? 'text-success' : 'text-muted-foreground'}`}>
            {connected ? (
              <>
                <span className="size-1.5 rounded-full bg-success" /> Live
              </>
            ) : (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Reconnecting…
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'question_closed' && view.advanceAtMs ? (
            <>
              <span className="tabular text-[13px] text-muted-foreground">
                Next in {Math.max(0, Math.ceil((view.advanceAtMs - clock.now()) / 1000))}
              </span>
              <Button variant="ghost" onClick={() => send({ type: WS_CLIENT.hold })}>Hold</Button>
            </>
          ) : null}
          {status !== 'finished' && (
            <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
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
          <kbd className="rounded-md border border-input px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Space</kbd>
        </div>
      </footer>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this game?</DialogTitle>
          </DialogHeader>
          <p className="text-[15px] text-muted-foreground">Results are saved for every player.</p>
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
      variant={primary.signal ? 'signal' : 'default'}
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
    <div className="flex flex-col items-center gap-[5vh]">
      <div className="flex flex-col items-center gap-[3vw] min-[1280px]:flex-row min-[1280px]:items-stretch">
        <SpecTag className="w-[min(720px,80vw)]">
          <div className="flex flex-col items-center py-[4vh]">
            <div className="tabular text-[clamp(5rem,11vw,11rem)] leading-none font-semibold tracking-[0.04em]">{joinCode}</div>
            <span className="mt-[2.5vh] h-0.5 w-20 bg-signal" aria-hidden="true" />
          </div>
          <SpecRow label="Join at" className="sm:items-center">
            <span className="text-[clamp(1.1rem,2vw,2.2rem)] font-medium">{location.host}/play</span>
          </SpecRow>
          <SpecRow label="Players" className="sm:items-center">
            <span className="tabular text-[clamp(1.1rem,2vw,2.2rem)] font-medium">{players.length}</span>
          </SpecRow>
        </SpecTag>
        {qr && (
          <div className="flex items-center rounded-md border bg-card p-3 shadow-label">
            <img src={qr} alt={`QR code for ${url}`} className="h-[18vh] w-[18vh]" />
          </div>
        )}
      </div>
      {players.length === 0 ? (
        <p className="text-[clamp(1rem,1.4vw,1.6rem)] text-muted-foreground">Waiting for players…</p>
      ) : (
        <ul className="flex max-h-[calc(3*(1.3vw*1.5+1.4vw)+2*0.8vw)] max-w-[70vw] flex-wrap justify-center gap-[0.8vw] overflow-hidden">
          {[...shown].reverse().map((p) => (
            <li key={p.playerId} className="rounded-full border border-input px-[1.1vw] py-[0.35vw] text-[1.3vw]">
              {p.alias}
            </li>
          ))}
          {extra > 0 && <li className="rounded-full border border-input px-[1.1vw] py-[0.35vw] text-[1.3vw] text-muted-foreground">+{extra} more</li>}
        </ul>
      )}
    </div>
  );
}

function QuestionStage({ open, ready, readySecondsLeft, k, n, question, remaining, answered, total, counts, correctIndex, leaderboard, deltas, showLeaderboard }) {
  if (ready) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-[3vh] text-center">
        <p className="tabular text-[1.4vw] text-muted-foreground">Question {k} / {n}</p>
        <h1 className="mx-auto max-w-[26ch] text-[3.2vw] leading-[1.15] font-medium tracking-[-0.02em]">{question.text}</h1>
        <p className="tabular text-[8vw] leading-none font-semibold">{readySecondsLeft}</p>
        <p className="text-[1.4vw] text-muted-foreground">Get ready</p>
      </div>
    );
  }
  return (
    <div className="flex w-full items-center gap-[3vw]">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between">
          <p className="tabular text-[1.4vw] text-muted-foreground">Question {k} / {n}</p>
          {open && (
            <div className="text-right">
              <div className={`tabular text-[5vw] leading-none font-semibold ${remaining <= 5 ? 'text-destructive' : ''}`}>{remaining}</div>
              <div className="tabular mt-[0.6vh] text-[1.2vw] text-muted-foreground">{answered} / {total} answered</div>
            </div>
          )}
        </div>
        <h1 className="mx-auto mt-[4vh] max-w-[26ch] text-center text-[3.2vw] leading-[1.15] font-medium tracking-[-0.02em]">{question.text}</h1>
        <div className="mt-[5vh] grid grid-cols-2 gap-[1.2vw]">
          {question.options.map((opt, i) => {
            const isCorrect = correctIndex === i;
            const dim = correctIndex !== null && !isCorrect;
            const share = totalPick(counts) ? (counts[i] / totalPick(counts)) * 100 : 0;
            return (
              <div
                key={i}
                className={`flex min-h-[16vh] flex-col justify-center rounded-md border bg-card px-[2vw] py-[2.4vh] transition-opacity ${dim ? 'opacity-40' : ''} ${isCorrect ? 'border-2 border-success bg-success-muted' : ''}`}
              >
                <div className="flex items-center gap-[1.2vw]">
                  <OptionShape index={i} size={undefined} className="h-[2.4vw] w-[2.4vw] shrink-0" />
                  <span className="min-w-0 flex-1 text-[2.2vw] leading-tight font-medium">{opt}</span>
                  {isCorrect && (
                    <span className="flex items-center gap-[0.5vw] text-success">
                      <Check className="h-[2vw] w-[2vw]" aria-hidden="true" />
                      <span className="text-[1.2vw] font-semibold tracking-[0.08em] uppercase">Correct</span>
                    </span>
                  )}
                </div>
                {correctIndex !== null && (
                  <div className="mt-[2vh] flex items-center gap-[1vw]">
                    <div className="h-0.5 flex-1 bg-foreground/10">
                      <div className={`h-full ${isCorrect ? 'bg-success' : 'bg-foreground/30'}`} style={{ width: `${share}%` }} />
                    </div>
                    <span className="tabular text-[1.4vw]">{counts[i] ?? 0}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showLeaderboard && (
        <SpecTag
          as="aside"
          className="w-[28vw] shrink-0"
          title={<span className="text-[1.6vw] font-medium">Leaderboard</span>}
        >
          {leaderboard.slice(0, 5).map((p, i) => (
            <div key={p.playerId} className="flex items-baseline gap-[1vw] px-5 py-[1.4vh]">
              <span className="tabular w-[2vw] text-[1.4vw] text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[1.8vw] font-medium">{p.alias}</span>
              {deltas[p.playerId] > 0 && <span className="tabular text-[1.1vw] text-success">+{deltas[p.playerId]}</span>}
              <span className="tabular text-[1.8vw] font-semibold">{p.score}</span>
            </div>
          ))}
        </SpecTag>
      )}
    </div>
  );
}
const totalPick = (counts) => counts.reduce((a, b) => a + b, 0);

function Finished({ leaderboard, questionCount }) {
  return (
    <div className="flex flex-col items-center gap-[4vh]">
      <h1 className="text-[3vw] font-medium tracking-[-0.02em]">Results</h1>
      <SpecTag className="w-[min(960px,70vw)]">
        {leaderboard.slice(0, 10).map((p, i) => (
          <div key={p.playerId} className={`flex items-baseline gap-[2vw] px-[2vw] py-[1.6vh] ${i < 3 ? 'text-[2.6vw]' : 'text-[1.8vw]'}`}>
            <span className="tabular w-[3vw] text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.alias}</span>
            <span className="tabular font-semibold">{p.score}</span>
          </div>
        ))}
      </SpecTag>
      <p className="tabular text-[1.3vw] text-muted-foreground">
        {plural(leaderboard.length, 'player', 'players')} · {plural(questionCount, 'question', 'questions')}
      </p>
    </div>
  );
}
