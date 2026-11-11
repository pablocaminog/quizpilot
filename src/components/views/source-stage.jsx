import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/messages';
import { formatCaptured, formatCount } from '@/lib/format';
import { AlertCircle, ClipboardType, ExternalLink, FileText, Globe, Loader2, PenLine } from 'lucide-react';
import { StageHeading } from '@/components/stage';
import { SpecRow, SpecTag } from '@/components/spec-tag';

const TILES = [
  { kind: 'url', icon: Globe, title: 'Website', desc: 'A public page' },
  { kind: 'text_upload', icon: FileText, title: 'Document', desc: 'PDF, .txt, or .md' },
  { kind: 'paste', icon: ClipboardType, title: 'Paste text', desc: 'Notes or an article' },
  { kind: 'generate', icon: PenLine, title: 'Brief', desc: 'No source; AI-generated' },
];
const KIND_ICONS = { ...Object.fromEntries(TILES.map((t) => [t.kind, t.icon])), pdf_upload: FileText };
const KIND_NAMES = { url: 'Website', text_upload: 'Text document', pdf_upload: 'PDF', paste: 'Pasted text', generate: 'Brief' };
const PASTE_LIMIT = 60000;

export function SourceSummary({ source }) {
  const Icon = KIND_ICONS[source.kind] ?? FileText;
  const excerpt = (source.excerpt ?? '').replace(/^#{1,6}\s+/gm, '').replace(/\n{3,}/g, '\n\n');
  return (
    <SpecTag
      title={
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate">{source.label}</span>
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <span className="truncate">{source.label}</span>
          )}
        </span>
      }
    >
      <SpecRow label="Kind">{KIND_NAMES[source.kind] ?? source.kind}</SpecRow>
      <SpecRow label="Captured"><span className="tabular">{formatCaptured(source.capturedAt)}</span></SpecRow>
      <SpecRow label="Length"><span className="tabular">{formatCount(source.charCount ?? 0)} characters</span></SpecRow>
      {excerpt && (
        <SpecRow label="Excerpt">
          <div className="max-h-40 overflow-y-auto pr-2 text-[14px] whitespace-pre-wrap text-foreground/85" tabIndex={0} role="region" aria-label="Source excerpt">
            {excerpt}
          </div>
        </SpecRow>
      )}
    </SpecTag>
  );
}

function Pending({ children }) {
  return (
    <div className="space-y-2.5 rounded-md border bg-card p-5">
      <Skeleton className="h-3.5 w-full bg-secondary" />
      <Skeleton className="h-3.5 w-5/6 bg-secondary" />
      <Skeleton className="h-3.5 w-2/3 bg-secondary" />
      <p className="type-small pt-1">{children}</p>
    </div>
  );
}

export default function SourceStage({ quiz, source, onSaved, readOnly }) {
  const [kind, setKind] = useState(source?.kind === 'pdf_upload' ? 'text_upload' : source?.kind ?? 'url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [brief, setBrief] = useState('');
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileIsPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');
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
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = ['text/plain', 'text/markdown'].includes(file.type) || /\.(txt|md)$/i.test(file.name);
        if (!isPdf && !isText) {
          setError('Choose a PDF, .txt, or .md file.');
          return;
        }
        if ((isPdf && file.size > 25 * 1024 * 1024) || (!isPdf && file.size > 512 * 1024)) {
          setError('This file is too large. PDFs can be up to 25 MB and text files up to 512 KB.');
          return;
        }
        const filename = encodeURIComponent(file.name);
        if (isPdf) {
          await api('sourcePdf', { quizId: quiz.id }, { body: file, raw: true, headers: { 'content-type': 'application/pdf', 'x-filename': filename } });
        } else {
          const type = file.type || (file.name.endsWith('.md') ? 'text/markdown' : 'text/plain');
          await api('sourceUpload', { quizId: quiz.id }, { body: file, raw: true, headers: { 'content-type': type, 'x-filename': filename } });
        }
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

  const action = (label, pendingLabel) => (
    <div className="flex justify-end">
      <Button onClick={submit} disabled={disabled}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {pending && pendingLabel ? pendingLabel : label}
      </Button>
    </div>
  );

  return (
    <div>
      <StageHeading step title="Choose a source" hint="Questions cite it, or are marked AI-generated." />

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
              className={`min-h-24 rounded-md border bg-card p-5 text-left transition-colors disabled:opacity-50 ${selected ? 'border-signal shadow-[inset_0_0_0_1px_var(--signal)]' : 'hover:border-input'}`}
            >
              <Icon className={`size-[18px] ${selected ? 'text-signal' : 'text-muted-foreground'}`} aria-hidden="true" />
              <div className="mt-3 text-[15px] font-medium">{t.title}</div>
              <div className="type-small mt-0.5">{t.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 space-y-4">
        {!readOnly && kind === 'url' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="source-url">Page URL</Label>
              <Input id="source-url" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            {action('Capture', 'Capturing…')}
            {pending && <Pending>Capturing the page…</Pending>}
          </>
        )}

        {!readOnly && kind === 'text_upload' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className={`flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-input bg-card p-5 transition-colors ${drag ? 'border-signal' : ''}`}
            >
              <p className="max-w-full truncate text-[15px] text-muted-foreground">{file ? file.name : 'Drop a file here'}</p>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Choose file</Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {action('Use document', fileIsPdf ? 'Reading…' : 'Uploading…')}
            {pending && fileIsPdf && <Pending>Reading the PDF…</Pending>}
          </>
        )}

        {!readOnly && kind === 'paste' && (
          <>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} aria-label="Source text" />
            <div className="flex items-center justify-between gap-4">
              <p className={`tabular text-[13px] ${text.length > PASTE_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formatCount(text.length)} / {formatCount(PASTE_LIMIT)}
              </p>
              <Button onClick={submit} disabled={disabled}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Use text
              </Button>
            </div>
          </>
        )}

        {!readOnly && kind === 'generate' && (
          <>
            <Textarea
              rows={5}
              placeholder="A 10-question warm-up on the history of the web"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              aria-label="Brief"
            />
            {action('Use brief')}
          </>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive-muted px-5 py-3.5">
            <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            <p className="flex-1 text-[14px]">{error}</p>
            <Button variant="ghost" size="sm" onClick={submit}>Retry</Button>
          </div>
        )}
      </div>

      {source && (
        <div className="mt-12 space-y-8">
          <SourceSummary source={source} />
          {!readOnly && (
            <div className="flex justify-center">
              <Button onClick={() => onSaved(true)}>Continue</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
