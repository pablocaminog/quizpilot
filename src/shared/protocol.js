/**
 * QuizPilot wire protocol — the single source of truth for HTTP routes,
 * error codes, and WebSocket event names/payloads shared by the Worker and
 * the React islands. Do not duplicate these literals elsewhere.
 */

/** Cookie names. `qp_host` identifies a host session; `qp_player` a player. */
export const COOKIES = { host: 'qp_host', player: 'qp_player' };

/**
 * HTTP routes. All host routes require the `qp_host` cookie; player join is
 * open, and `/ws/*` upgrades validate their cookie in the Worker before the
 * request reaches the room Durable Object.
 */
export const ROUTES = {
  health: 'GET /api/health',
  hostSession: 'POST /api/v1/host-session',
  createQuiz: 'POST /api/v1/quizzes',
  listQuizzes: 'GET /api/v1/quizzes',
  getQuiz: 'GET /api/v1/quizzes/:quizId',
  sourceUrl: 'PUT /api/v1/quizzes/:quizId/source/url',
  sourcePaste: 'PUT /api/v1/quizzes/:quizId/source/paste',
  sourceUpload: 'PUT /api/v1/quizzes/:quizId/source/upload',
  sourcePdf: 'PUT /api/v1/quizzes/:quizId/source/pdf',
  sourceGenerate: 'PUT /api/v1/quizzes/:quizId/source/generate',
  putQuestions: 'PUT /api/v1/quizzes/:quizId/questions',
  publishQuiz: 'POST /api/v1/quizzes/:quizId/publish',
  createGame: 'POST /api/v1/quizzes/:quizId/games',
  draftRun: 'POST /api/v1/quizzes/:quizId/draft-runs',
  draftRunEvents: 'GET /api/v1/quizzes/:quizId/draft-runs/:submissionId',
  joinGame: 'POST /api/v1/games/:joinCode/join',
  wsPlayer: 'GET /ws/games/:joinCode',
  wsHost: 'GET /ws/games/:joinCode/host',
};

/** JSON error codes returned as `{ error, message?, field? }`. */
export const ERRORS = {
  invalidJson: 'INVALID_JSON',
  invalidInput: 'INVALID_INPUT',
  bodyTooLarge: 'BODY_TOO_LARGE',
  sessionRequired: 'SESSION_REQUIRED',
  invalidOrigin: 'INVALID_ORIGIN',
  quizNotFound: 'QUIZ_NOT_FOUND',
  quizNotEditable: 'QUIZ_NOT_EDITABLE',
  sourceUnreadable: 'SOURCE_UNREADABLE',
  gameNotFound: 'GAME_NOT_FOUND',
  joinFailed: 'JOIN_FAILED',
  agentRunFailed: 'AGENT_RUN_FAILED',
  routeNotFound: 'ROUTE_NOT_FOUND',
  internal: 'INTERNAL_ERROR',
};

/**
 * Client -> server WebSocket messages. `type` is one of these literals.
 *
 * Host socket only:
 * - `{type:'start'}`            lobby -> first question_open
 * - `{type:'open_question'}`    question_closed -> question_open
 * - `{type:'close_question'}`   question_open -> question_closed (scores + reveal)
 * - `{type:'next_question'}`    question_closed -> question_open (next position)
 * - `{type:'finish'}`           -> finished (persists results)
 *
 * Player socket only:
 * - `{type:'answer', optionIndex}` one answer while question_open, before deadline
 */
export const WS_CLIENT = {
  start: 'start',
  openQuestion: 'open_question',
  closeQuestion: 'close_question',
  nextQuestion: 'next_question',
  finish: 'finish',
  answer: 'answer',
};

/**
 * Server -> client WebSocket events.
 *
 * - `room_snapshot` — full state on connect/reconnect, role-appropriate:
 *   players never receive `correctIndex` while a question is open.
 *     `{type, snapshot:{status, joinCode, quizId, serverNowMs, questionPosition,
 *       questionCount, question?, deadlineMs?, answeredCount,
 *       players:[{playerId,alias,score}], correctIndex?, results?, leaderboard?,
 *       you?:{playerId,alias,score,rank,currentAnswer:{selectedIndex,receivedAtMs}|null,
 *              lastResult:{questionPosition,selectedIndex,correct,score}|null}}}`
 *   `correctIndex`/`results`/`leaderboard` appear when `question_closed`;
 *   `leaderboard` also when `finished`. `you` appears on player sockets only.
 * - `question_open` `{type, questionPosition, question:{text,options,timerSeconds,correctIndex?}, deadlineMs, serverNowMs}`
 * - `answer_count` (host sockets only) `{type, questionPosition, answered, total}`
 * - `answer_accepted` `{type, playerId, questionPosition, receivedAtMs}` (no correctness until close)
 * - `question_closed` `{type, questionPosition, correctIndex, results:[{playerId,selectedIndex,correct,score}], leaderboard:[{playerId,alias,score,totalElapsedMs}]}`
 * - `game_finished` `{type, leaderboard}`
 * - `player_joined` `{type, player:{playerId,alias}}`
 * - `error` `{type, code, message}` — wrong role/state/late/duplicate/malformed
 */
export const WS_SERVER = {
  snapshot: 'room_snapshot',
  questionOpen: 'question_open',
  answerAccepted: 'answer_accepted',
  answerCount: 'answer_count',
  questionClosed: 'question_closed',
  gameFinished: 'game_finished',
  playerJoined: 'player_joined',
  error: 'error',
};

/** WebSocket error codes inside `error` events. */
export const WS_ERRORS = {
  malformed: 'MALFORMED_MESSAGE',
  wrongRole: 'WRONG_ROLE',
  wrongState: 'WRONG_STATE',
  lateAnswer: 'ANSWER_TOO_LATE',
  duplicateAnswer: 'ANSWER_DUPLICATE',
  outOfRange: 'OPTION_OUT_OF_RANGE',
};

/** Source kinds a quiz may select (exactly one active source per quiz). */
export const SOURCE_KINDS = ['paste', 'url', 'text_upload', 'pdf_upload', 'generate'];

/** Quiz lifecycle states. */
export const QUIZ_STATUSES = ['draft', 'published', 'archived'];

/** Game lifecycle states owned by the room Durable Object. */
export const GAME_STATUSES = ['lobby', 'question_open', 'question_closed', 'finished'];

/** Explicit provenance marker for quizzes generated without a source. */
export const AI_PROVENANCE = 'AI-generated';
