import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SpecRow, SpecTag } from '@/components/spec-tag';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { GAME_SETTINGS_DEFAULTS } from '@/shared/protocol.js';
import { toast } from 'sonner';

const TIMER = [
  { v: 'per_question', label: "Each question's timer" },
  { v: '10', label: '10 s' },
  { v: '20', label: '20 s' },
  { v: '30', label: '30 s' },
  { v: '60', label: '60 s' },
];
const READY = [
  { v: '0', label: 'Off' },
  { v: '3', label: '3 s' },
  { v: '5', label: '5 s' },
];
const ADVANCE = [
  { v: '0', label: 'When I press Next' },
  { v: '5', label: 'After 5 s' },
  { v: '8', label: 'After 8 s' },
  { v: '15', label: 'After 15 s' },
];

function RowSelect({ value, options, onChange, label }) {
  return (
    <Select value={value} onValueChange={onChange} aria-label={label}>
      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function GameSettings({ quizId, settings }) {
  const [s, setS] = useState({ ...GAME_SETTINGS_DEFAULTS, ...settings });
  useEffect(() => setS({ ...GAME_SETTINGS_DEFAULTS, ...settings }), [settings]);

  const save = async (patch) => {
    const prev = s;
    const next = { ...s, ...patch };
    setS(next);
    try {
      await api('putSettings', { quizId }, { body: patch });
    } catch (e) {
      setS(prev);
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SpecTag title="Game settings">
        <SpecRow label="Answer time">
          <RowSelect
            label="Answer time"
            value={s.timerMode === 'per_question' ? 'per_question' : String(s.fixedTimerSeconds)}
            options={TIMER}
            onChange={(v) => save(v === 'per_question' ? { timerMode: 'per_question' } : { timerMode: 'fixed', fixedTimerSeconds: Number(v) })}
          />
        </SpecRow>
        <SpecRow label="Get ready">
          <RowSelect label="Get ready" value={String(s.readySeconds)} options={READY} onChange={(v) => save({ readySeconds: Number(v) })} />
        </SpecRow>
        <SpecRow label="End early">
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">When everyone has answered</span>
            <Switch aria-label="End early when everyone has answered" checked={s.endWhenAllAnswered} onCheckedChange={(v) => save({ endWhenAllAnswered: v })} />
          </span>
        </SpecRow>
        <SpecRow label="Next question">
          <RowSelect label="Next question" value={String(s.autoAdvanceSeconds)} options={ADVANCE} onChange={(v) => save({ autoAdvanceSeconds: Number(v) })} />
        </SpecRow>
        <SpecRow label="Leaderboard">
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">After each question</span>
            <Switch aria-label="Leaderboard after each question" checked={s.showLeaderboard} onCheckedChange={(v) => save({ showLeaderboard: v })} />
          </span>
        </SpecRow>
        <SpecRow label="Shuffle">
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Questions</span>
            <Switch aria-label="Shuffle questions" checked={s.shuffleQuestions} onCheckedChange={(v) => save({ shuffleQuestions: v })} />
          </span>
          <span className="mt-2 flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Answers</span>
            <Switch aria-label="Shuffle answers" checked={s.shuffleOptions} onCheckedChange={(v) => save({ shuffleOptions: v })} />
          </span>
        </SpecRow>
        <SpecRow label="Speed bonus">
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Faster answers score more</span>
            <Switch aria-label="Speed bonus" checked={s.speedBonus} onCheckedChange={(v) => save({ speedBonus: v })} />
          </span>
        </SpecRow>
        <SpecRow label="Late joining">
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Players can join mid-game</span>
            <Switch aria-label="Late joining" checked={s.allowLateJoin} onCheckedChange={(v) => save({ allowLateJoin: v })} />
          </span>
        </SpecRow>
      </SpecTag>
      <p className="type-small mt-3 text-center text-muted-foreground">Applies to the next game you start.</p>
    </div>
  );
}
