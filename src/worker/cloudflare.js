import { DurableObject } from 'cloudflare:workers';
import { WS_CLIENT, WS_SERVER, WS_ERRORS } from '../shared/protocol.js';
import { parseAnswerMessage, scoreAnswer, orderLeaderboard } from './domain.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS room_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS players (player_id TEXT PRIMARY KEY, alias TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, total_elapsed_ms INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS answers (
  player_id TEXT NOT NULL, question_position INTEGER NOT NULL,
  received_at_ms INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL,
  selected_index INTEGER NOT NULL, correct INTEGER NOT NULL, score INTEGER NOT NULL,
  persisted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, question_position)
);
`;

function readState(sql) {
  const row = [...sql.exec("SELECT value FROM room_state WHERE key='state'")][0];
  return row ? JSON.parse(row.value) : null;
}
function writeState(sql, state) {
  sql.exec("INSERT INTO room_state(key,value) VALUES('state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(state));
}
function allPlayers(sql) {
  return [...sql.exec('SELECT player_id, alias, score, total_elapsed_ms FROM players')].map((r) => ({
    playerId: r.player_id, alias: r.alias, score: r.score, totalElapsedMs: r.total_elapsed_ms,
  }));
}

/**
 * QuizRoom — one Durable Object per game. It is the single authority for live
 * room state: hibernating WebSockets, server receipt timestamps for answers,
 * scoring, and batched D1 persistence on question close / game finish.
 */
export class QuizRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    ctx.storage.sql.exec(SCHEMA);
    this.state = readState(ctx.storage.sql);
    // Rebuild socket membership after eviction: identity lives on each
    // socket's serialized attachment, never in memory.
    this.sessions = new Map();
    for (const ws of ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment?.role) this.sessions.set(ws, attachment);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.state) return new Response('already initialized', { status: 409 });
      const { gameId, joinCode, quizId, questions } = await request.json();
      this.state = {
        gameId, joinCode, quizId,
        status: 'lobby',
        questions,
        questionCount: questions.length,
        questionPosition: -1,
        openedAtMs: null,
        deadlineMs: null,
      };
      writeState(this.ctx.storage.sql, this.state);
      return new Response('ok');
    }
    if (url.pathname === '/player-joined' && request.method === 'POST') {
      const { playerId, alias } = await request.json();
      this.ctx.storage.sql.exec(
        'INSERT INTO players(player_id, alias) VALUES(?,?) ON CONFLICT(player_id) DO NOTHING',
        playerId, alias,
      );
      this.broadcast({ type: WS_SERVER.playerJoined, player: { playerId, alias } });
      return new Response('ok');
    }
    if (url.pathname === '/ws') {
      const role = request.headers.get('x-quizpilot-role');
      if (!this.state || (role !== 'host' && role !== 'player')) return new Response('forbidden', { status: 403 });
      const attachment = {
        role,
        playerId: request.headers.get('x-quizpilot-player-id') || null,
        alias: request.headers.get('x-quizpilot-alias') || 'host',
      };
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);
      this.sessions.set(server, attachment);
      this.send(server, { type: WS_SERVER.snapshot, snapshot: this.snapshotFor(attachment.role, attachment.playerId) });
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws, raw) {
    const attachment = this.sessions.get(ws) ?? ws.deserializeAttachment();
    if (!attachment?.role || !this.state) return;
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return this.fail(ws, WS_ERRORS.malformed);
    }
    if (typeof message?.type !== 'string') return this.fail(ws, WS_ERRORS.malformed);

    if (attachment.role === 'host') {
      const allowed = [WS_CLIENT.start, WS_CLIENT.openQuestion, WS_CLIENT.closeQuestion, WS_CLIENT.nextQuestion, WS_CLIENT.finish];
      if (!allowed.includes(message.type)) return this.fail(ws, WS_ERRORS.wrongRole);
      return this.hostMessage(ws, message.type);
    }
    if (message.type !== WS_CLIENT.answer) return this.fail(ws, WS_ERRORS.wrongRole);
    return this.playerAnswer(ws, attachment, message);
  }

  async webSocketClose(ws) {
    this.sessions.delete(ws);
  }
  async webSocketError(ws) {
    this.sessions.delete(ws);
  }

  hostMessage(ws, type) {
    const s = this.state;
    const sql = this.ctx.storage.sql;
    switch (type) {
      case WS_CLIENT.start: {
        if (s.status !== 'lobby') return this.fail(ws, WS_ERRORS.wrongState);
        this.openQuestion(0);
        return;
      }
      case WS_CLIENT.nextQuestion:
      case WS_CLIENT.openQuestion: {
        if (s.status !== 'question_closed') return this.fail(ws, WS_ERRORS.wrongState);
        const next = s.questionPosition + 1;
        if (next >= s.questionCount) return this.fail(ws, WS_ERRORS.wrongState);
        this.openQuestion(next);
        return;
      }
      case WS_CLIENT.closeQuestion: {
        if (s.status !== 'question_open') return this.fail(ws, WS_ERRORS.wrongState);
        this.closeQuestion();
        return;
      }
      case WS_CLIENT.finish: {
        if (s.status === 'finished') return this.fail(ws, WS_ERRORS.wrongState);
        this.finishGame();
        return;
      }
      default:
        return this.fail(ws, WS_ERRORS.malformed);
    }
  }

  openQuestion(position) {
    const sql = this.ctx.storage.sql;
    const question = this.state.questions[position];
    // Authoritative timing is recorded before the broadcast.
    const openedAtMs = Date.now();
    this.state = {
      ...this.state,
      status: 'question_open',
      questionPosition: position,
      openedAtMs,
      deadlineMs: openedAtMs + question.timerSeconds * 1000,
    };
    writeState(sql, this.state);
    this.persistGameStatus('question_open');
    this.broadcastQuestion();
  }

  broadcastQuestion() {
    const s = this.state;
    const q = s.questions[s.questionPosition];
    for (const [ws, attachment] of this.sessions) {
      const payload = {
        type: WS_SERVER.questionOpen,
        questionPosition: s.questionPosition,
        question: {
          text: q.text,
          options: q.options,
          timerSeconds: q.timerSeconds,
          // Players never receive the correct index before the question closes.
          ...(attachment.role === 'host' ? { correctIndex: q.correctIndex } : {}),
        },
        deadlineMs: s.deadlineMs,
        serverNowMs: Date.now(),
      };
      this.send(ws, payload);
    }
  }

  playerAnswer(ws, attachment, message) {
    const s = this.state;
    if (s.status !== 'question_open') return this.fail(ws, WS_ERRORS.wrongState);
    const question = s.questions[s.questionPosition];
    const parsed = parseAnswerMessage(message, question.options.length);
    if (!parsed.ok) return this.fail(ws, parsed.code);
    // Server receipt time is authoritative — client clocks are never trusted.
    const receivedAtMs = Date.now();
    if (receivedAtMs >= s.deadlineMs) return this.fail(ws, WS_ERRORS.lateAnswer);
    const sql = this.ctx.storage.sql;
    const existing = [...sql.exec(
      'SELECT 1 FROM answers WHERE player_id=? AND question_position=?',
      attachment.playerId, s.questionPosition,
    )];
    if (existing.length) return this.fail(ws, WS_ERRORS.duplicateAnswer);

    const elapsedMs = receivedAtMs - s.openedAtMs;
    const correct = parsed.value === question.correctIndex ? 1 : 0;
    const score = correct ? scoreAnswer(elapsedMs, question.timerSeconds) : 0;
    // Persist the answer to DO storage before the accepted event is sent.
    sql.exec(
      'INSERT INTO answers(player_id, question_position, received_at_ms, elapsed_ms, selected_index, correct, score) VALUES(?,?,?,?,?,?,?)',
      attachment.playerId, s.questionPosition, receivedAtMs, elapsedMs, parsed.value, correct, score,
    );
    sql.exec(
      'UPDATE players SET score=score+?, total_elapsed_ms=total_elapsed_ms+? WHERE player_id=?',
      score, elapsedMs, attachment.playerId,
    );
    this.send(ws, {
      type: WS_SERVER.answerAccepted,
      playerId: attachment.playerId,
      questionPosition: s.questionPosition,
      receivedAtMs,
    });
    const answered = [...sql.exec(
      'SELECT COUNT(*) AS n FROM answers WHERE question_position=?', s.questionPosition,
    )][0].n;
    const total = [...sql.exec('SELECT COUNT(*) AS n FROM players')][0].n;
    const count = { type: WS_SERVER.answerCount, questionPosition: s.questionPosition, answered, total };
    for (const [socket, who] of this.sessions) if (who.role === 'host') this.send(socket, count);
  }

  closeQuestion() {
    const s = this.state;
    const sql = this.ctx.storage.sql;
    const question = s.questions[s.questionPosition];
    this.state = { ...s, status: 'question_closed', openedAtMs: null, deadlineMs: null };
    writeState(sql, this.state);
    this.persistGameStatus('question_closed');

    const results = [...sql.exec(
      'SELECT player_id, selected_index, correct, score FROM answers WHERE question_position=?',
      s.questionPosition,
    )].map((r) => ({ playerId: r.player_id, selectedIndex: r.selected_index, correct: !!r.correct, score: r.score }));
    const leaderboard = orderLeaderboard(allPlayers(sql));
    this.broadcast({
      type: WS_SERVER.questionClosed,
      questionPosition: s.questionPosition,
      correctIndex: question.correctIndex,
      results,
      leaderboard,
    });
    this.persistAnswers(s.questionPosition);
  }

  finishGame() {
    const s = this.state;
    const sql = this.ctx.storage.sql;
    this.state = { ...s, status: 'finished', openedAtMs: null, deadlineMs: null };
    writeState(sql, this.state);
    if (s.status === 'question_open' || s.status === 'question_closed') this.persistAnswers(s.questionPosition);
    this.persistGameStatus('finished', Date.now());
    this.broadcast({ type: WS_SERVER.gameFinished, leaderboard: orderLeaderboard(allPlayers(sql)) });
  }

  // D1 is the durable record, never the live scoreboard — writes are batched
  // at close_question and finish, one statement per unpersisted answer plus
  // one per player total.
  persistAnswers(questionPosition) {
    if (questionPosition == null || questionPosition < 0) return;
    const gameId = this.state.gameId;
    const sql = this.ctx.storage.sql;
    const rows = [...sql.exec(
      'SELECT * FROM answers WHERE question_position=? AND persisted=0',
      questionPosition,
    )];
    if (!rows.length) return;
    const players = allPlayers(sql);
    const statements = [
      ...rows.map((r) =>
        this.env.DB.prepare(
          'INSERT OR IGNORE INTO answers(game_id, player_id, question_position, received_at_ms, elapsed_ms, selected_index, correct, score) VALUES(?,?,?,?,?,?,?,?)',
        ).bind(gameId, r.player_id, questionPosition, r.received_at_ms, r.elapsed_ms, r.selected_index, r.correct, r.score),
      ),
      ...players.map((p) =>
        this.env.DB.prepare('UPDATE players SET total_score=?, total_elapsed_ms=? WHERE id=?')
          .bind(p.score, p.totalElapsedMs, p.playerId),
      ),
    ];
    this.ctx.waitUntil(
      this.env.DB.batch(statements).then(() => {
        sql.exec('UPDATE answers SET persisted=1 WHERE question_position=?', questionPosition);
      }),
    );
  }

  persistGameStatus(status, finishedAt = null) {
    this.ctx.waitUntil(
      this.env.DB.prepare('UPDATE games SET status=?, finished_at=COALESCE(?, finished_at) WHERE id=?')
        .bind(status, finishedAt, this.state.gameId)
        .run(),
    );
  }

  answeredCount(position) {
    if (position == null || position < 0) return 0;
    return [...this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM answers WHERE question_position=?', position)][0].n;
  }

  snapshotFor(role, playerId = null) {
    const s = this.state;
    const sql = this.ctx.storage.sql;
    const leaderboard = orderLeaderboard(allPlayers(sql));
    const snapshot = {
      status: s.status,
      joinCode: s.joinCode,
      quizId: s.quizId,
      serverNowMs: Date.now(),
      questionPosition: s.questionPosition,
      questionCount: s.questionCount,
      deadlineMs: s.deadlineMs,
      answeredCount: this.answeredCount(s.questionPosition),
      players: leaderboard,
    };
    if (s.status === 'question_open' && s.questionPosition >= 0) {
      const q = s.questions[s.questionPosition];
      snapshot.question = {
        text: q.text, options: q.options, timerSeconds: q.timerSeconds,
        ...(role === 'host' ? { correctIndex: q.correctIndex } : {}),
      };
    } else if (s.status === 'question_closed' && s.questionPosition >= 0) {
      const q = s.questions[s.questionPosition];
      snapshot.question = { text: q.text, options: q.options, timerSeconds: q.timerSeconds, correctIndex: q.correctIndex };
      snapshot.correctIndex = q.correctIndex;
      snapshot.results = [...sql.exec(
        'SELECT player_id, selected_index, correct, score FROM answers WHERE question_position=?', s.questionPosition,
      )].map((r) => ({ playerId: r.player_id, selectedIndex: r.selected_index, correct: !!r.correct, score: r.score }));
      snapshot.leaderboard = leaderboard;
    } else if (s.status === 'finished') {
      snapshot.leaderboard = leaderboard;
    }
    if (role === 'player' && playerId) {
      const me = leaderboard.findIndex((p) => p.playerId === playerId);
      const mine = me >= 0 ? leaderboard[me] : null;
      let currentAnswer = null;
      if (s.status === 'question_open' && s.questionPosition >= 0) {
        const row = [...sql.exec(
          'SELECT selected_index, received_at_ms FROM answers WHERE player_id=? AND question_position=?',
          playerId, s.questionPosition,
        )][0];
        if (row) currentAnswer = { selectedIndex: row.selected_index, receivedAtMs: row.received_at_ms };
      }
      let lastResult = null;
      if (s.questionPosition >= 0) {
        const row = [...sql.exec(
          'SELECT selected_index, correct, score FROM answers WHERE player_id=? AND question_position=?',
          playerId, s.questionPosition,
        )][0];
        if (row) lastResult = { questionPosition: s.questionPosition, selectedIndex: row.selected_index, correct: !!row.correct, score: row.score };
      }
      snapshot.you = {
        playerId,
        alias: mine?.alias ?? null,
        score: mine?.score ?? 0,
        rank: me >= 0 ? me + 1 : null,
        currentAnswer,
        lastResult: s.status === 'question_open' ? null : lastResult,
      };
    }
    return snapshot;
  }

  send(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      this.sessions.delete(ws);
    }
  }
  broadcast(payload) {
    for (const ws of this.sessions.keys()) this.send(ws, payload);
  }
  fail(ws, code) {
    this.send(ws, { type: WS_SERVER.error, code });
  }
}
