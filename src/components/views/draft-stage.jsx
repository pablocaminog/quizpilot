import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { route, api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { Conversation, DrafterMessage, HostMessage } from '@/components/ai/conversation';
import { PromptInput } from '@/components/ai/prompt-input';
import { Sources } from '@/components/ai/sources';
import { StageHeading } from '@/components/stage';
import { plural } from '@/lib/format';

const STATUS_BY_KIND = [
  [/read|source|attach/i, 'Reading the source…'],
  [/think|reason|draft|generat|model|assistant/i, 'Drafting questions…'],
];

function statusFor(chunk) {
  const text = typeof chunk === 'string' ? chunk : chunk?.type ?? chunk?.kind ?? JSON.stringify(chunk);
  for (const [re, label] of STATUS_BY_KIND) if (re.test(text)) return label;
  return 'Working…';
}

function parseProposal(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default function DraftStage({ quiz, source, onProposed, onReview }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState(null);
  const streamRef = useRef(null);
  const lastInstruction = useRef(null);

  const suggestions = [
    `8 questions for ${quiz.audience}, medium difficulty`,
    'Focus on the key definitions',
    'Make it a quick 5-question warm-up',
  ];

  const push = (msg) => setMessages((m) => [...m, msg]);

  const send = async (instruction) => {
    const text = (instruction ?? prompt).trim();
    if (!text || streaming) return;
    lastInstruction.current = text;
    setPrompt('');
    setStreaming(true);
    setStatus('Working…');
    push({ role: 'host', text });
    try {
      const { submissionId } = await api('draftRun', { quizId: quiz.id }, { body: { instruction: text } });
      const { path } = route('draftRunEvents', { quizId: quiz.id, submissionId });
      const es = new EventSource(path);
      streamRef.current = es;
      es.addEventListener('event', (e) => setStatus(statusFor(JSON.parse(e.data))));
      es.addEventListener('reply', async (e) => {
        es.close();
        setStreaming(false);
        const proposal = parseProposal(JSON.parse(e.data).text);
        if (!proposal) {
          push({ role: 'drafter', kind: 'error', text: "The draft wasn't valid. Ask for a revision.", retry: true });
          return;
        }
        try {
          const saved = await api('putQuestions', { quizId: quiz.id }, { body: proposal });
          onProposed(saved.questions);
          const citations = saved.questions.flatMap((q) => q.citations ?? []);
          push({
            role: 'drafter',
            kind: 'proposal',
            text: `${plural(saved.questions.length, 'question', 'questions')} proposed`,
            citations,
            aiGenerated: saved.questions.every((q) => q.provenance === 'AI-generated'),
          });
        } catch (err) {
          push({
            role: 'drafter',
            kind: 'error',
            text: `The draft wasn't valid: ${err.message ?? 'invalid question set'}`,
            retry: true,
          });
        }
      });
      es.addEventListener('error', (e) => {
        es.close();
        setStreaming(false);
        let copy = errorMessage({ error: 'AGENT_RUN_FAILED' });
        try {
          copy = errorMessage({ error: JSON.parse(e.data).error });
        } catch {}
        push({ role: 'drafter', kind: 'error', text: copy, retry: true });
      });
    } catch (err) {
      setStreaming(false);
      push({ role: 'drafter', kind: 'error', text: errorMessage(err), retry: true });
    }
  };

  const stop = () => {
    streamRef.current?.close();
    setStreaming(false);
  };

  return (
    <div className={`flex flex-col ${messages.length || streaming ? 'h-[calc(100dvh-56px-8rem-92px)] min-h-[480px]' : ''}`}>
      <StageHeading step title="Draft with AI" hint="Nothing is saved until you review it." />

      <Conversation>
        
        {messages.map((m, i) =>
          m.role === 'host' ? (
            <HostMessage key={i}>{m.text}</HostMessage>
          ) : (
            <DrafterMessage key={i}>
              {m.kind === 'error' ? (
                <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive-muted px-4 py-3">
                  <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  <p className="flex-1 text-[14px]">{m.text}</p>
                  {m.retry && (
                    <Button variant="ghost" size="sm" onClick={() => send(lastInstruction.current)}>
                      Retry
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p>{m.text}</p>
                  {m.citations?.length > 0 && <Sources citations={m.citations} />}
                  {m.aiGenerated && <p className="type-small">Marked AI-generated.</p>}
                  {m.kind === 'proposal' && <Button onClick={onReview}>Review</Button>}
                </div>
              )}
            </DrafterMessage>
          ),
        )}
        {streaming && (
          <DrafterMessage>
            <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {status}
            </span>
          </DrafterMessage>
        )}
      </Conversation>

      {messages.length === 0 && !streaming && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Button key={s} variant="outline" size="sm" className="h-auto min-h-9 py-1.5 whitespace-normal" onClick={() => setPrompt(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSend={() => send()}
        onStop={stop}
        disabled={streaming}
        streaming={streaming}
        source={source}
      />
    </div>
  );
}
