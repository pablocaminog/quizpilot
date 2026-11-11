import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL;
const STATE = process.env.TEST_STATE;
const CONFIG = process.env.WRANGLER_CONFIG;

function cookieFrom(response, name) {
  const raw = response.headers.get('set-cookie') ?? '';
  const pair = raw.split(';')[0];
  return pair.startsWith(name + '=') ? pair : null;
}

async function api(path, { method = 'GET', cookie, body, headers } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {}
  return { status: response.status, json, response };
}

function connectWs(path, cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace('http', 'ws') + path, { headers: { cookie } });
    const events = [];
    const waiters = [];
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      events.push(data);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].pred(data)) {
          waiters[i].resolve(data);
          waiters.splice(i, 1);
          cursor = Math.max(cursor, events.length);
        }
      }
    });
    let cursor = 0;
    ws.addEventListener('open', () =>
      resolve({
        ws,
        events,
        send: (msg) => ws.send(JSON.stringify(msg)),
        next: (pred, timeoutMs = 15000) => {
          const idx = events.findIndex((e, i) => i >= cursor && pred(e));
          const existing = idx >= 0 ? events[idx] : undefined;
          if (idx >= 0) cursor = idx + 1;
          if (existing) return Promise.resolve(existing);
          return new Promise((res, rej) => {
            const waiter = { pred, resolve: res };
            waiters.push(waiter);
            setTimeout(() => {
              const idx = waiters.indexOf(waiter);
              if (idx >= 0) {
                waiters.splice(idx, 1);
                rej(new Error('timed out waiting for event'));
              }
            }, timeoutMs);
          });
        },
      }),
    );
    ws.addEventListener('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const citedQuestion = (text, over = {}) => ({
  text,
  options: ['Alpha', 'Beta', 'Gamma'],
  correctIndex: 1,
  timerSeconds: 5,
  rationale: 'Checks recall.',
  citations: [{ label: 'Notes', excerpt: 'photosynthesis converts light' }],
  ...over,
});

function d1(sql) {
  const out = execFileSync(
    process.execPath,
    ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--persist-to', STATE, '--config', CONFIG, '--command', sql, '--json'],
    { env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' }, encoding: 'utf-8' },
  );
  return JSON.parse(out)[0].results;
}

test('full game scenario: host flow, auth, room, scoring, persistence', async (t) => {
  await t.test('health and session gating', async () => {
    const health = await api('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.application, 'quizpilot');
    const denied = await api('/api/v1/quizzes', { method: 'POST', body: { title: 't', audience: 'a', learningGoal: 'g' } });
    assert.equal(denied.status, 401);
    assert.equal(denied.json.error, 'SESSION_REQUIRED');
  });

  const session = await api('/api/v1/host-session', { method: 'POST', body: {} });
  assert.equal(session.status, 201);
  const host = cookieFrom(session.response, 'qp_host');
  assert.ok(host);

  let quizId;
  await t.test('create quiz and paste source', async () => {
    const created = await api('/api/v1/quizzes', { method: 'POST', cookie: host, body: { title: 'Bio 101', audience: 'students', learningGoal: 'photosynthesis basics' } });
    assert.equal(created.status, 201);
    quizId = created.json.quiz.id;
    const source = await api(`/api/v1/quizzes/${quizId}/source/paste`, {
      method: 'PUT', cookie: host,
      body: { text: 'Photosynthesis converts light energy into chemical energy in chloroplasts. Plants absorb CO2 and release oxygen.' },
    });
    assert.equal(source.status, 200);
    assert.equal(source.json.source.kind, 'paste');
    assert.ok(source.json.source.excerpt.includes('Photosynthesis'));
    assert.ok(source.json.source.charCount > 0);
  });

  await t.test('invalid proposal rejected with 400 INVALID_INPUT', async () => {
    const res = await api(`/api/v1/quizzes/${quizId}/questions`, {
      method: 'PUT', cookie: host,
      body: { questions: [{ text: 'Q?', options: ['a'], correctIndex: 0, timerSeconds: 5, rationale: 'r', citations: [{ label: 'x', excerpt: 'y' }] }] },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'INVALID_INPUT');
  });

  await t.test('valid sourced two-question proposal accepted', async () => {
    const res = await api(`/api/v1/quizzes/${quizId}/questions`, {
      method: 'PUT', cookie: host,
      body: { questions: [citedQuestion('Where does photosynthesis happen?'), citedQuestion('What do plants release?', { correctIndex: 2 })] },
    });
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json.questions.length, 2);
  });

  let joinCode;
  await t.test('publish then create game', async () => {
    const published = await api(`/api/v1/quizzes/${quizId}/publish`, { method: 'POST', cookie: host });
    assert.equal(published.status, 200, JSON.stringify(published.json));
    const game = await api(`/api/v1/quizzes/${quizId}/games`, { method: 'POST', cookie: host });
    assert.equal(game.status, 201);
    joinCode = game.json.game.joinCode;
    assert.match(joinCode, /^[A-Z0-9]{6}$/);
    // published quizzes are immutable
    const edit = await api(`/api/v1/quizzes/${quizId}/questions`, { method: 'PUT', cookie: host, body: { questions: [] } });
    assert.equal(edit.status, 409);
    assert.equal(edit.json.error, 'QUIZ_NOT_EDITABLE');
  });

  let player1, player2, p1Cookie, p2Cookie;
  await t.test('two players join', async () => {
    player1 = await api(`/api/v1/games/${joinCode}/join`, { method: 'POST', body: { alias: 'Ada' } });
    assert.equal(player1.status, 201);
    p1Cookie = cookieFrom(player1.response, 'qp_player');
    player2 = await api(`/api/v1/games/${joinCode}/join`, { method: 'POST', body: { alias: 'Boris' } });
    assert.equal(player2.status, 201);
    p2Cookie = cookieFrom(player2.response, 'qp_player');
    const badAlias = await api(`/api/v1/games/${joinCode}/join`, { method: 'POST', body: { alias: '' } });
    assert.equal(badAlias.status, 400);
  });

  let hostWs, p1Ws, p2Ws;
  await t.test('websocket admission enforces cookies and roles', async () => {
    hostWs = await connectWs(`/ws/games/${joinCode}/host`, host);
    const snap = await hostWs.next((e) => e.type === 'room_snapshot');
    assert.equal(snap.snapshot.status, 'lobby');
    assert.equal(typeof snap.snapshot.serverNowMs, 'number');
    assert.equal(snap.snapshot.quizId, quizId);
    p1Ws = await connectWs(`/ws/games/${joinCode}`, p1Cookie);
    p2Ws = await connectWs(`/ws/games/${joinCode}`, p2Cookie);
    await p1Ws.next((e) => e.type === 'room_snapshot');
    // non-host cannot start the game
    p1Ws.send({ type: 'start' });
    const err = await p1Ws.next((e) => e.type === 'error');
    assert.equal(err.code, 'WRONG_ROLE');
    // anonymous upgrade is rejected (server answers 401, so the socket never opens)
    await new Promise((resolve, reject) => {
      const anon = new WebSocket(BASE.replace('http', 'ws') + `/ws/games/${joinCode}`);
      const timer = setTimeout(() => reject(new Error('anonymous socket unexpectedly opened')), 5000);
      anon.addEventListener('open', () => { clearTimeout(timer); reject(new Error('anonymous socket opened')); });
      anon.addEventListener('error', () => { clearTimeout(timer); resolve(); });
    });
  });

  await t.test('open/answer/close with server timestamps and late rejection', async () => {
    hostWs.send({ type: 'start' });
    const open = await p1Ws.next((e) => e.type === 'question_open');
    assert.equal(open.questionPosition, 0);
    assert.equal(open.question.correctIndex, undefined, 'players must not see correctIndex while open');
    const hostOpen = await hostWs.next((e) => e.type === 'question_open');
    assert.equal(typeof hostOpen.question.correctIndex, 'number', 'host sees correctIndex');

    p1Ws.send({ type: 'answer', optionIndex: 1 });
    const accepted = await p1Ws.next((e) => e.type === 'answer_accepted');
    assert.equal(typeof accepted.receivedAtMs, 'number');

    // duplicate answer rejected
    p1Ws.send({ type: 'answer', optionIndex: 0 });
    const dup = await p1Ws.next((e) => e.type === 'error');
    assert.equal(dup.code, 'ANSWER_DUPLICATE');

    // host sees the running answer count
    const count = await hostWs.next((e) => e.type === 'answer_count');
    assert.equal(count.questionPosition, 0);
    assert.equal(count.answered, 1);
    assert.equal(count.total, 2);

    // a reconnecting player's snapshot restores their locked answer
    const p1b = await connectWs(`/ws/games/${joinCode}`, p1Cookie);
    const resnap = await p1b.next((e) => e.type === 'room_snapshot');
    assert.equal(resnap.snapshot.you.currentAnswer.selectedIndex, 1);
    assert.equal(resnap.snapshot.you.alias, 'Ada');
    p1b.ws.close();

    // post-deadline answer rejected (timer is 5s)
    await sleep(5200);
    p2Ws.send({ type: 'answer', optionIndex: 2 });
    const late = await p2Ws.next((e) => e.type === 'error');
    assert.equal(late.code, 'ANSWER_TOO_LATE');

    hostWs.send({ type: 'close_question' });
    const closed = await p1Ws.next((e) => e.type === 'question_closed');
    assert.equal(closed.correctIndex, 1);
    assert.equal(closed.results.length, 1);
    assert.ok(closed.results[0].correct);
    assert.ok(closed.results[0].score >= 500 && closed.results[0].score <= 1000);
    assert.equal(closed.leaderboard[0].alias, 'Ada');

    // after close, a reconnecting player's snapshot carries their last result
    const p1c = await connectWs(`/ws/games/${joinCode}`, p1Cookie);
    const closedSnap = await p1c.next((e) => e.type === 'room_snapshot');
    assert.equal(closedSnap.snapshot.you.lastResult.correct, true);
    assert.equal(closedSnap.snapshot.you.lastResult.questionPosition, 0);
    assert.ok(closedSnap.snapshot.you.score > 0);
    p1c.ws.close();
  });

  await t.test('finish persists exactly one timestamped answer per player/question', async () => {
    hostWs.send({ type: 'finish' });
    await p1Ws.next((e) => e.type === 'game_finished');
    await sleep(800); // batched D1 writes are waitUntil-async
    const answers = d1('SELECT game_id, player_id, question_position, received_at_ms, elapsed_ms, selected_index, correct, score FROM answers');
    assert.equal(answers.length, 1);
    assert.equal(answers[0].question_position, 0);
    assert.ok(answers[0].received_at_ms > 0);
    assert.ok(answers[0].elapsed_ms >= 0);
    assert.equal(answers[0].correct, 1);
    const game = d1(`SELECT status, finished_at FROM games WHERE join_code='${joinCode}'`);
    assert.equal(game[0].status, 'finished');
  });

  for (const s of [hostWs, p1Ws, p2Ws]) s?.ws.close();
});

test('generate source: AI-generated provenance required, citations forbidden', async (t) => {
  const session = await api('/api/v1/host-session', { method: 'POST', body: {} });
  const host = cookieFrom(session.response, 'qp_host');
  const created = await api('/api/v1/quizzes', { method: 'POST', cookie: host, body: { title: 'Gen', audience: 'all', learningGoal: 'general knowledge' } });
  const quizId = created.json.quiz.id;
  const source = await api(`/api/v1/quizzes/${quizId}/source/generate`, { method: 'PUT', cookie: host, body: { brief: 'quiz about the solar system' } });
  assert.equal(source.status, 200);
  assert.equal(source.json.source.kind, 'generate');

  // A source-style proposal with citations is rejected for a generate quiz.
  const cited = await api(`/api/v1/quizzes/${quizId}/questions`, {
    method: 'PUT', cookie: host,
    body: { questions: [citedQuestion('Q1'), citedQuestion('Q2')] },
  });
  assert.equal(cited.status, 400);
  assert.equal(cited.json.error, 'INVALID_INPUT');

  // Missing provenance is also rejected.
  const noProv = await api(`/api/v1/quizzes/${quizId}/questions`, {
    method: 'PUT', cookie: host,
    body: { questions: [citedQuestion('Q1', { citations: undefined }), citedQuestion('Q2', { citations: undefined })] },
  });
  assert.equal(noProv.status, 400);

  // Explicit AI-generated provenance is accepted.
  const gen = (text) => ({
    text, options: ['a', 'b'], correctIndex: 0, timerSeconds: 10,
    rationale: 'Common knowledge.', provenance: 'AI-generated',
  });
  const ok = await api(`/api/v1/quizzes/${quizId}/questions`, {
    method: 'PUT', cookie: host,
    body: { questions: [gen('Biggest planet?'), gen('Closest to the sun?')] },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
});

test('host isolation: a second host cannot read or mutate the quiz', async () => {
  const s1 = await api('/api/v1/host-session', { method: 'POST', body: {} });
  const h1 = cookieFrom(s1.response, 'qp_host');
  const s2 = await api('/api/v1/host-session', { method: 'POST', body: {} });
  const h2 = cookieFrom(s2.response, 'qp_host');
  const created = await api('/api/v1/quizzes', { method: 'POST', cookie: h1, body: { title: 'Private', audience: 'a', learningGoal: 'g' } });
  const quizId = created.json.quiz.id;
  const read = await api(`/api/v1/quizzes/${quizId}`, { cookie: h2 });
  assert.equal(read.status, 404);
  const list = await api('/api/v1/quizzes', { cookie: h2 });
  assert.equal(list.json.quizzes.length, 0);
});

test('ssrf guards on url source', async () => {
  const session = await api('/api/v1/host-session', { method: 'POST', body: {} });
  const host = cookieFrom(session.response, 'qp_host');
  const created = await api('/api/v1/quizzes', { method: 'POST', cookie: host, body: { title: 'S', audience: 'a', learningGoal: 'g' } });
  const quizId = created.json.quiz.id;
  for (const url of ['http://example.com', 'https://127.0.0.1/', 'https://localhost/', 'https://192.168.0.1/']) {
    const res = await api(`/api/v1/quizzes/${quizId}/source/url`, { method: 'PUT', cookie: host, body: { url } });
    assert.equal(res.status, 400, url);
    assert.equal(res.json.error, 'INVALID_INPUT');
  }
});

test('spa serves the built shell for client routes', async () => {
  const res = await fetch(BASE + '/play/ABCDEF');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /app-shell|QuizPilot|astro/i);
});

test('pdf source upload', async () => {
  const session = await api('/api/v1/host-session', { method: 'POST', body: {} });
  const host = cookieFrom(session.response, 'qp_host');
  const created = await api('/api/v1/quizzes', { method: 'POST', cookie: host, body: { title: 'PDF', audience: 'a', learningGoal: 'g' } });
  const quizId = created.json.quiz.id;
  const put = async (body, headers) => {
    const res = await fetch(`${BASE}/api/v1/quizzes/${quizId}/source/pdf`, {
      method: 'PUT', headers: { cookie: host, 'x-filename': 'sample.pdf', ...headers }, body,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  // non-PDF bytes are rejected
  const bad = await put(Buffer.from('not a pdf'), { 'content-type': 'application/pdf' });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'INVALID_INPUT');

  // over 10 MiB is rejected
  const big = await put(Buffer.alloc(10 * 1024 * 1024 + 1), { 'content-type': 'application/pdf' });
  assert.equal(big.status, 413);
  assert.equal(big.json.error, 'BODY_TOO_LARGE');

  // a real minimal PDF: local AI.toMarkdown is unsupported, so the honest
  // outcome is 422 SOURCE_UNREADABLE and no source row is created.
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 24 Tf 72 720 Td (Hello QuizPilot) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF');
  const res = await put(pdf, { 'content-type': 'application/pdf' });
  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.error, 'SOURCE_UNREADABLE');
  const rows = d1(`SELECT COUNT(*) AS n FROM sources WHERE quiz_id='${quizId}'`);
  assert.equal(rows[0].n, 0);

  // text upload over 512 KiB is still rejected
  const bigText = await fetch(`${BASE}/api/v1/quizzes/${quizId}/source/upload`, {
    method: 'PUT', headers: { cookie: host, 'content-type': 'text/plain' }, body: Buffer.alloc(512 * 1024 + 1, 'a'),
  });
  assert.equal(bigText.status, 413);
});
