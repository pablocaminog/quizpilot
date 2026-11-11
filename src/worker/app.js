import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { dispatch, init, AgentRunError } from '@flue/runtime';
import { COOKIES, ERRORS } from '../shared/protocol.js';
import {
  LIMITS,
  parseJsonBody,
  parseHostBrief,
  parseSourceUrl,
  parsePasteSource,
  parseGenerateSource,
  readConversionMarkdown,
  parseDraftInstruction,
  parseQuizProposal,
  parseAlias,
  parseJoinCode,
  readQuickActionMarkdown,
} from './domain.js';
import { QuizDrafter } from './agents/quiz-drafter.js';

const app = new Hono();
const JSON_LIMIT = 256 * 1024;
const UPLOAD_TYPES = new Set(['text/plain', 'text/markdown']);

const sha256 = async (text) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const cookieValue = (request, name) =>
  request.headers.get('cookie')?.split(';').map((p) => p.trim()).find((p) => p.startsWith(name + '='))?.slice(name.length + 1) ?? null;

async function hostSession(request, db) {
  const token = cookieValue(request, COOKIES.host);
  if (!token || !/^[a-f0-9-]{72}$/.test(token)) return null;
  return db.prepare('SELECT token_hash FROM host_sessions WHERE token_hash=? AND expires_at>?')
    .bind(await sha256(token), Date.now())
    .first();
}

async function playerSession(request, db, gameId) {
  const token = cookieValue(request, COOKIES.player);
  if (!token || !/^[a-f0-9-]{72}$/.test(token)) return null;
  return db.prepare('SELECT id, alias FROM players WHERE token_hash=? AND game_id=?')
    .bind(await sha256(token), gameId)
    .first();
}

async function ownedQuiz(c, sessionId, quizId) {
  const quiz = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id=? AND host_session_id=?')
    .bind(quizId, sessionId)
    .first();
  return quiz ?? null;
}

const jsonError = (c, status, code, message, field) => c.json({ error: code, ...(message ? { message } : {}), ...(field ? { field } : {}) }, status);
const bad = (c, r) => jsonError(c, 400, r.code ?? ERRORS.invalidInput, r.message, r.field ?? undefined);

async function readBody(c, limit) {
  const length = Number(c.req.header('content-length') ?? 0);
  if (length > limit) return { ok: false, code: ERRORS.bodyTooLarge };
  const text = await c.req.text();
  if (new TextEncoder().encode(text).byteLength > limit) return { ok: false, code: ERRORS.bodyTooLarge };
  return parseJsonBody(text);
}

app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
  await next();
});

app.use('/api/*', bodyLimit({ maxSize: LIMITS.pdfBytes + 4096, onError: (c) => jsonError(c, 413, ERRORS.bodyTooLarge) }));

// Same-origin enforcement for unsafe browser requests.
app.use('/api/*', async (c, next) => {
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin) return jsonError(c, 403, ERRORS.invalidOrigin);
  }
  await next();
});

app.get('/api/health', async (c) => {
  await c.env.DB.prepare('SELECT 1').first();
  return c.json({ ok: true, application: 'quizpilot' });
});

app.post('/api/v1/host-session', async (c) => {
  if (await hostSession(c.req.raw, c.env.DB)) return c.json({ ready: true, existing: true });
  const token = crypto.randomUUID() + crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO host_sessions(token_hash, created_at, expires_at) VALUES(?,?,?)')
    .bind(await sha256(token), Date.now(), Date.now() + 7 * 86400000)
    .run();
  c.header('Set-Cookie', `${COOKIES.host}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);
  return c.json({ ready: true, existing: false }, 201);
});

// Every draft, source, chat, question, and game-control route requires the
// host session — 401 before any object existence detail can leak.
const requireHost = async (c, next) => {
  const session = await hostSession(c.req.raw, c.env.DB);
  if (!session) return jsonError(c, 401, ERRORS.sessionRequired);
  c.set('hostSessionId', session.token_hash);
  await next();
};
app.use('/api/v1/quizzes', requireHost);
app.use('/api/v1/quizzes/*', requireHost);

app.post('/api/v1/quizzes', async (c) => {
  const body = await readBody(c, JSON_LIMIT);
  if (!body.ok) return bad(c, body);
  const brief = parseHostBrief(body.value);
  if (!brief.ok) return bad(c, brief);
  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO quizzes(id, host_session_id, title, audience, learning_goal, status, created_at, updated_at) VALUES(?,?,?,? ,?,'draft',?,?)",
  ).bind(id, c.get('hostSessionId'), brief.value.title, brief.value.audience, brief.value.learningGoal, now, now).run();
  return c.json({ quiz: { id, ...brief.value, status: 'draft', createdAt: now } }, 201);
});

app.get('/api/v1/quizzes', async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, title, audience, learning_goal, status, created_at, updated_at, published_url FROM quizzes WHERE host_session_id=? AND status IN ('draft','published') ORDER BY updated_at DESC",
  ).bind(c.get('hostSessionId')).all();
  return c.json({ quizzes: rows.results.map(quizView) });
});

app.get('/api/v1/quizzes/:quizId', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz) return jsonError(c, 404, ERRORS.quizNotFound);
  const [sources, questions] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM sources WHERE quiz_id=? ORDER BY created_at DESC').bind(quiz.id).all(),
    c.env.DB.prepare('SELECT position, text, options_json, correct_index, timer_seconds, rationale, provenance, citations_json FROM questions WHERE quiz_id=? ORDER BY position').bind(quiz.id).all(),
  ]);
  const latest = sources.results[0] ?? null;
  let latestView = null;
  if (latest) {
    const object = await c.env.SOURCES.get(latest.r2_key);
    latestView = sourceView(latest, object ? (await object.text()).slice(0, 600) : '');
  }
  return c.json({
    quiz: quizView(quiz),
    source: latestView,
    sources: sources.results.map((s) => sourceView(s)),
    questions: questions.results.map(questionView),
  });
});

function quizView(q) {
  return {
    id: q.id, title: q.title, audience: q.audience, learningGoal: q.learning_goal,
    status: q.status, createdAt: q.created_at, updatedAt: q.updated_at, publishedUrl: q.published_url,
  };
}
function questionView(q) {
  return {
    position: q.position, text: q.text, options: JSON.parse(q.options_json),
    correctIndex: q.correct_index, timerSeconds: q.timer_seconds, rationale: q.rationale,
    provenance: q.provenance, citations: JSON.parse(q.citations_json),
  };
}

async function latestSource(db, quizId) {
  return db.prepare('SELECT * FROM sources WHERE quiz_id=? ORDER BY created_at DESC LIMIT 1').bind(quizId).first();
}

const sourceView = (row, content = null) => ({
  id: row.id,
  kind: row.kind,
  label: row.label,
  url: row.url,
  capturedAt: row.captured_at,
  byteLength: row.byte_length,
  charCount: row.char_count ?? (content != null ? content.length : undefined),
  ...(content != null ? { excerpt: content.slice(0, 500) } : {}),
  createdAt: row.created_at,
});

async function writeSource(c, quizId, kind, label, content, url = null) {
  const bytes = new TextEncoder().encode(content);
  const sourceId = crypto.randomUUID();
  const r2Key = `sources/${quizId}/${sourceId}`;
  const now = Date.now();
  await c.env.SOURCES.put(r2Key, bytes);
  await c.env.DB.prepare(
    'INSERT INTO sources(id, quiz_id, kind, label, r2_key, url, captured_at, byte_length, char_count, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
  ).bind(sourceId, quizId, kind, label, r2Key, url, now, bytes.byteLength, content.length, now).run();
  return sourceView(
    { id: sourceId, kind, label, url, captured_at: now, byte_length: bytes.byteLength, char_count: content.length, created_at: now },
    content,
  );
}

app.put('/api/v1/quizzes/:quizId/source/url', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz || quiz.status !== 'draft') return jsonError(c, quiz ? 409 : 404, quiz ? ERRORS.quizNotEditable : ERRORS.quizNotFound);
  const body = await readBody(c, JSON_LIMIT);
  if (!body.ok) return bad(c, body);
  const parsed = parseSourceUrl(body.value);
  if (!parsed.ok) return bad(c, parsed);

  // Kitesurf renders the public page to Markdown — the only supported URL
  // source path. There is intentionally no fetch()/HTMLRewriter fallback.
  let markdown;
  try {
    const result = await c.env.BROWSER.quickAction('markdown', {
      url: parsed.value,
      browser: 'kitesurf',
      gotoOptions: { waitUntil: 'networkidle0' },
    });
    markdown = await readQuickActionMarkdown(result);
  } catch (error) {
    console.error(JSON.stringify({ event: 'kitesurf_error', error: String(error) }));
    return jsonError(c, 422, ERRORS.sourceUnreadable, 'The page could not be rendered.');
  }
  if (!markdown) return jsonError(c, 422, ERRORS.sourceUnreadable, 'The page produced no readable content.');
  const source = await writeSource(c, quiz.id, 'url', parsed.value, markdown.slice(0, LIMITS.sourceContent), parsed.value);
  return c.json({ source });
});

app.put('/api/v1/quizzes/:quizId/source/paste', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz || quiz.status !== 'draft') return jsonError(c, quiz ? 409 : 404, quiz ? ERRORS.quizNotEditable : ERRORS.quizNotFound);
  const body = await readBody(c, LIMITS.pasteText + 4096);
  if (!body.ok) return bad(c, body);
  const parsed = parsePasteSource(body.value);
  if (!parsed.ok) return bad(c, parsed);
  const source = await writeSource(c, quiz.id, 'paste', parsed.value.label ?? 'Pasted text', parsed.value.text.slice(0, LIMITS.sourceContent));
  return c.json({ source });
});

app.put('/api/v1/quizzes/:quizId/source/upload', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz || quiz.status !== 'draft') return jsonError(c, quiz ? 409 : 404, quiz ? ERRORS.quizNotEditable : ERRORS.quizNotFound);
  const type = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!UPLOAD_TYPES.has(type)) return jsonError(c, 400, ERRORS.invalidInput, 'Only text/plain or text/markdown documents are supported.', 'document');
  const buffer = await c.req.arrayBuffer();
  if (buffer.byteLength > LIMITS.uploadBytes) return jsonError(c, 413, ERRORS.bodyTooLarge);
  if (!buffer.byteLength) return jsonError(c, 400, ERRORS.invalidInput, 'The document is empty.', 'document');
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const source = await writeSource(c, quiz.id, 'text_upload', uploadName(c, 'Text document'), text.slice(0, LIMITS.sourceContent));
  return c.json({ source });
});

// Filenames arrive URI-encoded (headers are Latin-1 only); bound the label.
function uploadName(c, fallback) {
  const raw = c.req.header('x-filename');
  if (!raw) return fallback;
  let name;
  try {
    name = decodeURIComponent(raw);
  } catch {
    name = raw;
  }
  return name.trim().slice(0, 200) || fallback;
}

app.put('/api/v1/quizzes/:quizId/source/pdf', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz || quiz.status !== 'draft') return jsonError(c, quiz ? 409 : 404, quiz ? ERRORS.quizNotEditable : ERRORS.quizNotFound);
  const type = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/pdf') return jsonError(c, 400, ERRORS.invalidInput, 'Only application/pdf documents are supported.', 'document');
  const buffer = await c.req.arrayBuffer();
  if (buffer.byteLength > LIMITS.pdfBytes) return jsonError(c, 413, ERRORS.bodyTooLarge);
  if (!buffer.byteLength) return jsonError(c, 400, ERRORS.invalidInput, 'The document is empty.', 'document');
  const magic = new TextDecoder().decode(buffer.slice(0, 5));
  if (magic !== '%PDF-') return jsonError(c, 400, ERRORS.invalidInput, "This file isn't a valid PDF.", 'document');

  const filename = uploadName(c, 'PDF document');
  let markdown;
  try {
    const result = await c.env.AI.toMarkdown({
      name: filename,
      blob: new Blob([buffer], { type: 'application/pdf' }),
    });
    markdown = readConversionMarkdown(result);
  } catch (error) {
    console.error(JSON.stringify({ event: 'pdf_convert_error', error: String(error) }));
    return jsonError(c, 422, ERRORS.sourceUnreadable);
  }
  if (!markdown) {
    return jsonError(c, 422, ERRORS.sourceUnreadable, "We couldn't find selectable text in this PDF. Scanned PDFs aren't supported yet; paste the text instead.");
  }
  const source = await writeSource(c, quiz.id, 'pdf_upload', filename, markdown.slice(0, LIMITS.sourceContent));
  await c.env.SOURCES.put(`sources/${quiz.id}/${source.id}.pdf`, buffer, {
    httpMetadata: { contentType: 'application/pdf' },
  });
  return c.json({ source });
});

app.put('/api/v1/quizzes/:quizId/source/generate', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz || quiz.status !== 'draft') return jsonError(c, quiz ? 409 : 404, quiz ? ERRORS.quizNotEditable : ERRORS.quizNotFound);
  const body = await readBody(c, JSON_LIMIT);
  if (!body.ok) return bad(c, body);
  const parsed = parseGenerateSource(body.value);
  if (!parsed.ok) return bad(c, parsed);
  const source = await writeSource(c, quiz.id, 'generate', 'Create from brief', parsed.value.brief);
  return c.json({ source });
});

app.put('/api/v1/quizzes/:quizId/questions', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz) return jsonError(c, 404, ERRORS.quizNotFound);
  if (quiz.status !== 'draft') return jsonError(c, 409, ERRORS.quizNotEditable);
  const body = await readBody(c, JSON_LIMIT);
  if (!body.ok) return bad(c, body);
  const source = await latestSource(c.env.DB, quiz.id);
  const proposal = parseQuizProposal(body.value, source?.kind ?? 'generate');
  if (!proposal.ok) return bad(c, proposal);

  const statements = [c.env.DB.prepare('DELETE FROM questions WHERE quiz_id=?').bind(quiz.id)];
  proposal.value.questions.forEach((q, i) => {
    statements.push(
      c.env.DB.prepare(
        'INSERT INTO questions(id, quiz_id, position, text, options_json, correct_index, timer_seconds, rationale, provenance, citations_json) VALUES(?,?,?,?,?,?,?,?,?,?)',
      ).bind(crypto.randomUUID(), quiz.id, i, q.text, JSON.stringify(q.options), q.correctIndex, q.timerSeconds, q.rationale, q.provenance, JSON.stringify(q.citations)),
    );
  });
  statements.push(c.env.DB.prepare('UPDATE quizzes SET updated_at=? WHERE id=?').bind(Date.now(), quiz.id));
  await c.env.DB.batch(statements);
  return c.json({ questions: proposal.value.questions.map((q, i) => ({ position: i, ...q })) });
});

app.post('/api/v1/quizzes/:quizId/publish', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz) return jsonError(c, 404, ERRORS.quizNotFound);
  if (quiz.status !== 'draft') return jsonError(c, 409, ERRORS.quizNotEditable);
  const [source, questions] = await Promise.all([
    latestSource(c.env.DB, quiz.id),
    c.env.DB.prepare('SELECT * FROM questions WHERE quiz_id=? ORDER BY position').bind(quiz.id).all(),
  ]);
  if (!source) return jsonError(c, 400, ERRORS.invalidInput, 'Select a source before publishing.', 'source');
  const revalidated = parseQuizProposal(
    { questions: questions.results.map(questionView) },
    source.kind,
  );
  if (!revalidated.ok) return bad(c, revalidated);
  const publishedUrl = `/host/quiz/${quiz.id}`;
  await c.env.DB.prepare("UPDATE quizzes SET status='published', published_url=?, updated_at=? WHERE id=? AND status='draft'")
    .bind(publishedUrl, Date.now(), quiz.id).run();
  return c.json({ quiz: { ...quizView(quiz), status: 'published', publishedUrl } });
});

app.post('/api/v1/quizzes/:quizId/games', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz) return jsonError(c, 404, ERRORS.quizNotFound);
  if (quiz.status !== 'published') return jsonError(c, 409, ERRORS.quizNotEditable, 'Only a published quiz can start a game.');
  const questions = await c.env.DB.prepare('SELECT * FROM questions WHERE quiz_id=? ORDER BY position').bind(quiz.id).all();
  if (!questions.results.length) return jsonError(c, 400, ERRORS.invalidInput, 'The quiz has no questions.', 'questions');

  // Collision-checked six-character uppercase join code.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let joinCode = null;
  for (let attempt = 0; attempt < 10 && !joinCode; attempt++) {
    const candidate = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join('');
    const taken = await c.env.DB.prepare("SELECT id FROM games WHERE join_code=? AND status!='finished'").bind(candidate).first();
    if (!taken) joinCode = candidate;
  }
  if (!joinCode) return jsonError(c, 500, ERRORS.internal);

  const gameId = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO games(id, quiz_id, join_code, status, created_at) VALUES(?,?,?,'lobby',?)")
    .bind(gameId, quiz.id, joinCode, Date.now()).run();

  // Initialize the room Durable Object with the immutable published question
  // set before the join code is returned.
  const stub = c.env.QUIZ_ROOM.get(c.env.QUIZ_ROOM.idFromName(gameId));
  const initResponse = await stub.fetch('https://room/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      gameId,
      joinCode,
      quizId: quiz.id,
      dbGameId: gameId,
      questions: questions.results.map(questionView),
    }),
  });
  if (!initResponse.ok) return jsonError(c, 500, ERRORS.internal);
  return c.json({ game: { id: gameId, joinCode, status: 'lobby' } }, 201);
});

app.post('/api/v1/quizzes/:quizId/draft-runs', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz) return jsonError(c, 404, ERRORS.quizNotFound);
  if (quiz.status !== 'draft') return jsonError(c, 409, ERRORS.quizNotEditable);
  const body = await readBody(c, JSON_LIMIT);
  if (!body.ok) return bad(c, body);
  const parsed = parseDraftInstruction(body.value);
  if (!parsed.ok) return bad(c, parsed);

  const source = await latestSource(c.env.DB, quiz.id);
  let content = '';
  if (source) {
    const object = await c.env.SOURCES.get(source.r2_key);
    content = object ? (await object.text()).slice(0, LIMITS.sourceContent) : '';
  }
  const receipt = await dispatch(QuizDrafter, {
    id: quiz.id,
    message: {
      kind: 'signal',
      type: 'quiz.draft.requested',
      body: JSON.stringify({
        instruction: parsed.value.instruction,
        source: source
          ? { id: source.id, kind: source.kind, label: source.label, content }
          : null,
      }),
      attributes: {
        quizId: quiz.id,
        sourceId: source?.id ?? null,
        sourceKind: source?.kind ?? 'none',
        sourceLabel: source?.label ?? null,
      },
    },
  });
  return c.json({ submissionId: receipt.submissionId }, 202);
});

app.get('/api/v1/quizzes/:quizId/draft-runs/:submissionId', async (c) => {
  const quiz = await ownedQuiz(c, c.get('hostSessionId'), c.req.param('quizId'));
  if (!quiz) return jsonError(c, 404, ERRORS.quizNotFound);
  const submissionId = c.req.param('submissionId');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const receipt = { submissionId };
        const reply = await init(QuizDrafter, { id: quiz.id }).read(receipt, {
          onEvent: (chunk) => send('event', chunk),
        });
        send('reply', { text: reply?.text ?? '' });
      } catch (error) {
        if (error instanceof AgentRunError || error?.name === 'AgentRunError') {
          send('error', { error: ERRORS.agentRunFailed, outcome: error.outcome ?? 'failed' });
        } else {
          send('error', { error: ERRORS.agentRunFailed });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
});

app.post('/api/v1/games/:joinCode/join', async (c) => {
  const joinCode = c.req.param('joinCode');
  if (!parseJoinCode(joinCode)) return jsonError(c, 404, ERRORS.gameNotFound);
  const body = await readBody(c, JSON_LIMIT);
  if (!body.ok) return bad(c, body);
  const parsed = parseAlias(body.value);
  if (!parsed.ok) return bad(c, parsed);
  const game = await c.env.DB.prepare("SELECT id, status FROM games WHERE join_code=?").bind(joinCode).first();
  if (!game || game.status === 'finished') return jsonError(c, 404, ERRORS.gameNotFound);
  const playerId = crypto.randomUUID();
  const token = crypto.randomUUID() + crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO players(id, game_id, alias, token_hash, joined_at) VALUES(?,?,?,?,?)')
      .bind(playerId, game.id, parsed.value.alias, await sha256(token), Date.now()).run();
  } catch {
    return jsonError(c, 409, ERRORS.joinFailed, 'Could not join the game.');
  }
  // Let the room know a player exists so it can include them in snapshots.
  const stub = c.env.QUIZ_ROOM.get(c.env.QUIZ_ROOM.idFromName(game.id));
  await stub.fetch('https://room/player-joined', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId, alias: parsed.value.alias }),
  });
  c.header('Set-Cookie', `${COOKIES.player}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
  return c.json({ player: { id: playerId, alias: parsed.value.alias }, joinCode }, 201);
});

// WebSocket admission: cookies are verified in the Worker, then the upgrade is
// proxied to the deterministic QUIZ_ROOM id for the game with verified
// role/identity headers. The Durable Object re-checks them defensively.
app.get('/ws/games/:joinCode', async (c) => proxyToRoom(c, 'player'));
app.get('/ws/games/:joinCode/host', async (c) => proxyToRoom(c, 'host'));

async function proxyToRoom(c, role) {
  const joinCode = c.req.param('joinCode');
  if (!parseJoinCode(joinCode)) return jsonError(c, 404, ERRORS.gameNotFound);
  const game = await c.env.DB.prepare('SELECT id, status FROM games WHERE join_code=?').bind(joinCode).first();
  if (!game || game.status === 'finished') return jsonError(c, 404, ERRORS.gameNotFound);
  if (c.req.header('upgrade') !== 'websocket') return jsonError(c, 400, ERRORS.invalidInput, 'Expected a WebSocket upgrade.');

  let identity;
  if (role === 'host') {
    const session = await hostSession(c.req.raw, c.env.DB);
    if (!session) return jsonError(c, 401, ERRORS.sessionRequired);
    const owns = await c.env.DB.prepare('SELECT g.id FROM games g JOIN quizzes q ON q.id=g.quiz_id WHERE g.id=? AND q.host_session_id=?')
      .bind(game.id, session.token_hash).first();
    if (!owns) return jsonError(c, 403, ERRORS.sessionRequired);
    identity = { role: 'host', playerId: null, alias: 'host' };
  } else {
    const player = await playerSession(c.req.raw, c.env.DB, game.id);
    if (!player) return jsonError(c, 401, ERRORS.sessionRequired);
    identity = { role: 'player', playerId: player.id, alias: player.alias };
  }

  const stub = c.env.QUIZ_ROOM.get(c.env.QUIZ_ROOM.idFromName(game.id));
  const request = new Request('https://room/ws', {
    headers: {
      upgrade: 'websocket',
      'x-quizpilot-role': identity.role,
      'x-quizpilot-player-id': identity.playerId ?? '',
      'x-quizpilot-alias': identity.alias,
    },
  });
  return stub.fetch(request);
}

app.all('/api/*', (c) => jsonError(c, 404, ERRORS.routeNotFound));
app.onError((error, c) => {
  console.error(JSON.stringify({ event: 'api_error', path: c.req.path, error: String(error) }));
  return jsonError(c, 500, ERRORS.internal);
});

export default app;
