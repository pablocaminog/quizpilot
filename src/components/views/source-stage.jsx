import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { formatCaptured, formatCount } from '@/lib/format';
import {
  AlertCircle, CircleCheck, ClipboardType, ExternalLink, FileText, Globe, Loader2, PenLine,
} from 'lucide-react';

const TILES = [
  { kind: 'url', icon: Globe, title: 'Website URL', desc: 'A public page, rendered and captured with Cloudflare Kitesurf.' },
  { kind: 'text_upload', icon: FileText, title: 'Text document', desc: '.txt or .md, up to 512 KB.' },
  { kind: 'paste', icon: ClipboardType, title: 'Paste text', desc: 'Notes, an article, or a transcript.' },
  { kind: 'generate', icon: PenLine, title: 'Create from brief', desc: 'No source. Every question is marked AI-generated.' },
];
const KIND_ICONS = Object.fromEntries(TILES.map((t) => [t.kind, t.icon]));
const PASTE_LIMIT = 60000;

export function SourceSummary({ source }) {
  const Icon = KIND_ICONS[source.kind] ?? FileText;
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="size-4" aria-hidden="true" />
        {source.url ? (
          <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[15px] font-medium underline">
            {source.label}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[15px] font-medium">{source.label}</span>
        )}
        <span className="tabular ml-auto text-[13px] text-muted-foreground">
          Captured {formatCaptured(source.capturedAt)} · {formatCount(source.charCount)} characters
        </span>
      </div>
      <ScrollArea className="max-h-40">
        <p className="px-4 py-3 text-[14px] whitespace-pre-wrap">{source.excerpt}</p>
      </ScrollArea>
    </div>
  );
}

export default function SourceStage({ quiz, source, onSaved, readOnly }) {
  const [kind, setKind] = useState(source?.kind ?? 'url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [brief, setBrief] = useState('');
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      if (kind === 'url') {
        await api('sourceUrl', { quizId: quiz.id }, { body: { url } });
      } else if (kind === 'paste') {
        await api('sourcePaste', { quizId: quiz.id }, { body: { text } });
      } else if (kind === 'generate') {
        await api('sourceGenerate', { quizId: quiz.id }, { body: { brief } });
      } else if (kind === 'text_upload') {
        if (!file) return;
        const type = file.type || (file.name.endsWith('.md') ? 'text/markdown' : 'text/plain');
        if (!['text/plain', 'text/markdown'].includes(type)) {
          setError('Only text/plain or text/markdown documents are supported.');
          return;
        }
        await api('sourceUpload', { quizId: quiz.id }, { body: file, raw: true, headers: { 'content-type': type, 'x-filename': file.name } });
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const disabled = pending || readOnly ||
    (kind === 'url' ? !url.trim() : kind === 'paste' ? !text.trim() || text.length > PASTE_LIMIT : kind === 'generate' ? !brief.trim() : !file);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Choose a source</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Questions will cite this source, or be marked AI-generated when you start from a brief.
        </p>
      </div>

      <div role="radiogroup" aria-label="Source kind" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((t) => {
          const Icon = t.icon;
          const selected = kind === t.kind;
          return (
            <button
              key={t.kind}
              role="radio"
              aria-checked={selected}
              disabled={readOnly}
              onClick={() => setKind(t.kind)}
              className={`relative min-h-[88px] rounded-lg border p-4 text-left ${selected ? 'ring-2 ring-primary border-primary' : ''} disabled:opacity-60`}
            >
              {selected && <CircleCheck className="absolute right-3 top-3 size-5 text-primary" aria-hidden="true" />}
              <Icon className="size-5" aria-hidden="true" />
              <div className="mt-2 text-[15px] font-medium">{t.title}</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {!readOnly && kind === 'url' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="source-url">Page URL</Label>
            <Input id="source-url" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={disabled}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Capturing…' : 'Capture page'}
          </Button>
          {pending && (
            <div className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <p className="text-[13px] text-muted-foreground">
                Rendering the page in Kitesurf. This can take up to 30 seconds.
              </p>
            </div>
          )}
        </div>
      )}

      {!readOnly && kind === 'text_upload' && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={`flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 ${drag ? 'border-primary' : ''}`}
          >
            <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-[14px] text-muted-foreground">{file ? file.name : 'Drop a .txt or .md file here'}</p>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Choose file</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={submit} disabled={disabled}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Use this document
          </Button>
        </div>
      )}

      {!readOnly && kind === 'paste' && (
        <div className="space-y-3">
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          <p className={`tabular text-[13px] ${text.length > PASTE_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`}>
            {formatCount(text.length)} / {formatCount(PASTE_LIMIT)} characters
          </p>
          <Button onClick={submit} disabled={disabled}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Use this text
          </Button>
        </div>
      )}

      {!readOnly && kind === 'generate' && (
        <div className="space-y-3">
          <Textarea
            rows={5}
            placeholder="e.g. A 10-question warm-up on the history of the web for a team offsite"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <Button onClick={submit} disabled={disabled}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Use this brief
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border bg-destructive-muted p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-[14px]">{error}</p>
          <Button variant="secondary" size="sm" onClick={submit}>Try again</Button>
        </div>
      )}

      {source && (
        <div className="space-y-3">
          <SourceSummary source={source} />
          {!readOnly && <Button onClick={() => onSaved(true)}>Continue to draft</Button>}
        </div>
      )}
    </div>
  );
}
