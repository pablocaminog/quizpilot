/**
 * QuizPilot domain boundary: every parser here validates and normalizes one
 * wire payload. Parsers return `{ ok: true, value }` or
 * `{ ok: false, code, field, message }` — never throw on bad input.
 */
import * as v from 'valibot';
import { AI_PROVENANCE, ERRORS, SOURCE_KINDS, QUIZ_STATUSES, GAME_STATUSES, GAME_SETTINGS_DEFAULTS, GAME_SETTINGS_CHOICES } from '../shared/protocol.js';

export { SOURCE_KINDS, QUIZ_STATUSES, GAME_STATUSES, AI_PROVENANCE, GAME_SETTINGS_DEFAULTS, GAME_SETTINGS_CHOICES };

export const LIMITS = {
  briefText: 2000,
  pasteText: 60000,
  uploadBytes: 512 * 1024,
  pdfBytes: 25 * 1024 * 1024,
  sourceContent: 60000,
  instruction: 2000,
  aliasMin: 1,
  aliasMax: 30,
  questionsMin: 2,
  questionsMax: 20,
  optionsMin: 2,
  optionsMax: 4,
  optionText: 240,
  questionText: 500,
  rationale: 1000,
  timerMin: 5,
  timerMax: 120,
  citationsMin: 1,
};

function fail(field, message, code = ERRORS.invalidInput) {
  return { ok: false, code, field, message };
}
function invalidJson() {
  return { ok: false, code: ERRORS.invalidJson, field: null, message: 'Body is not valid JSON.' };
}

function run(schema, body) {
  const result = v.safeParse(schema, body);
  if (!result.success) {
    const issue = result.issues[0];
    const field = issue.path?.map((p) => p.key).join('.') ?? null;
    return fail(field, issue.message);
  }
  return { ok: true, value: result.output };
}

export function parseJsonBody(text) {
  if (typeof text !== 'string' || !text.trim()) return invalidJson();
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return invalidJson();
  }
}

const hostBriefSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  audience: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  learningGoal: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.briefText)),
});
export const parseHostBrief = (body) => run(hostBriefSchema, body);

const urlSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2048));
const pasteSchema = v.object({
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(LIMITS.pasteText)),
  label: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
});
const generateSchema = v.object({
  brief: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.briefText)),
});
const instructionSchema = v.object({
  instruction: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.instruction)),
});
export const parsePasteSource = (body) => run(pasteSchema, body);
export const parseGenerateSource = (body) => run(generateSchema, body);
export const parseDraftInstruction = (body) => run(instructionSchema, body);

/**
 * Validate a public, unauthenticated https URL: no credentials, no localhost,
 * and no literal loopback/private/link-local/reserved IP address. Hostnames
 * are not resolved here — literal-IP and name-shape checks only.
 */
export function parseSourceUrl(body) {
  const raw = run(urlSchema, body?.url);
  if (!raw.ok) return fail('url', raw.message);
  let url;
  try {
    url = new URL(raw.value);
  } catch {
    return fail('url', 'Not a valid URL.');
  }
  if (url.protocol !== 'https:') return fail('url', 'Only https: URLs are supported.');
  if (url.username || url.password) return fail('url', 'URLs with credentials are not allowed.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return fail('url', 'Localhost and internal hostnames are not allowed.');
  }
  if (isBlockedIp(host)) return fail('url', 'Private, loopback, link-local, or reserved addresses are not allowed.');
  return { ok: true, value: url.toString() };
}

function isBlockedIp(host) {
  const ipv6 = host.replace(/^\[|\]$/g, '');
  if (/^::1$/.test(ipv6) || /^fe[89ab]/i.test(ipv6) || /^(fc|fd)[0-9a-f]{2}:/i.test(ipv6) || ipv6 === '::') return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const [a, b] = host.split('.').map(Number);
  if ([a, b].some((n) => Number.isNaN(n) || n > 255)) return true;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true; // current-net, private, loopback, multicast/reserved
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 (incl. 192.0.2 docs)
  if (a === 198 && b === 51) return true; // TEST-NET-2
  if (a === 203 && b === 0) return true; // TEST-NET-3
  return false;
}

const citationSchema = v.object({
  label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  excerpt: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2000)),
});

const questionSchema = v.object({
  text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.questionText)),
  options: v.pipe(
    v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.optionText))),
    v.minLength(LIMITS.optionsMin),
    v.maxLength(LIMITS.optionsMax),
  ),
  correctIndex: v.pipe(v.number(), v.integer(), v.minValue(0)),
  timerSeconds: v.pipe(v.number(), v.integer(), v.minValue(LIMITS.timerMin), v.maxValue(LIMITS.timerMax)),
  rationale: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.rationale)),
  provenance: v.optional(v.string()),
  citations: v.optional(v.array(citationSchema)),
});

/**
 * Validate a full draft question set or a model `QuizDraftProposal`.
 * `sourceKind` decides provenance: non-`generate` sources require at least one
 * citation on every question; `generate` requires explicit `AI-generated`
 * provenance and forbids citations.
 */
export function parseQuizProposal(body, sourceKind) {
  const parsed = run(v.object({ questions: v.array(v.any()) }), body);
  if (!parsed.ok) return fail('questions', parsed.message);
  const { questions } = parsed.value;
  if (questions.length < LIMITS.questionsMin) return fail('questions', `Provide at least ${LIMITS.questionsMin} questions.`);
  if (questions.length > LIMITS.questionsMax) return fail('questions', `Provide at most ${LIMITS.questionsMax} questions.`);

  const out = [];
  for (let i = 0; i < questions.length; i++) {
    const field = `questions[${i}]`;
    const q = run(questionSchema, questions[i]);
    if (!q.ok) return fail(`${field}.${q.field ?? ''}`.replace(/\.$/, ''), q.message);
    const value = q.value;
    if (value.correctIndex >= value.options.length) {
      return fail(`${field}.correctIndex`, 'correctIndex must be a valid option index.');
    }
    const citations = value.citations ?? [];
    if (sourceKind === 'generate') {
      if (value.provenance !== undefined && value.provenance !== AI_PROVENANCE) {
        return fail(`${field}.provenance`, `Generated quizzes must use "${AI_PROVENANCE}" provenance.`);
      }
      if (value.provenance !== AI_PROVENANCE) {
        return fail(`${field}.provenance`, `Generated quizzes must declare "${AI_PROVENANCE}" provenance.`);
      }
      if (citations.length) return fail(`${field}.citations`, 'Generated quizzes must not cite a source.');
    } else {
      if (!citations.length) return fail(`${field}.citations`, 'Each question must cite at least one source excerpt.');
    }
    out.push({
      text: value.text,
      options: value.options,
      correctIndex: value.correctIndex,
      timerSeconds: value.timerSeconds,
      rationale: value.rationale,
      provenance: sourceKind === 'generate' ? AI_PROVENANCE : 'source',
      citations,
    });
  }
  return { ok: true, value: { questions: out } };
}

/**
 * Normalize the Workers AI toMarkdown ConversionResult: a single result or an
 * array (first entry wins); 'error' format or missing/blank data yields ''.
 */
export function readConversionMarkdown(result) {
  const entry = Array.isArray(result) ? result[0] : result;
  if (!entry || entry.format === 'error') return '';
  const data = typeof entry.data === 'string' ? entry.data : '';
  // PDF conversions wrap content in a "# name / ## Metadata / ## Contents"
  // envelope; keep only the contents, and treat page headings alone (an
  // image-only scan) as no readable text.
  const marker = data.indexOf('\n## Contents\n');
  const body = (marker === -1 ? data : data.slice(marker + '\n## Contents\n'.length)).trim();
  return body.replace(/^#{1,6} Page \d+\s*$/gm, '').trim() ? body : '';
}

export function parseAlias(body) {
  const parsed = run(
    v.object({ alias: v.pipe(v.string(), v.trim(), v.minLength(LIMITS.aliasMin), v.maxLength(LIMITS.aliasMax)) }),
    body,
  );
  return parsed;
}

export function parseJoinCode(joinCode) {
  return typeof joinCode === 'string' && /^[A-Z0-9]{6}$/.test(joinCode);
}

/** Player `answer` message: one integer option index. */
export function parseAnswerMessage(message, optionCount) {
  if (!message || typeof message !== 'object' || message.type !== 'answer') {
    return { ok: false, code: 'MALFORMED_MESSAGE' };
  }
  const { optionIndex } = message;
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= optionCount) {
    return { ok: false, code: 'OPTION_OUT_OF_RANGE' };
  }
  return { ok: true, value: optionIndex };
}

/** Score a correct answer: faster is better, bounded below by half credit; flat when speedBonus is off. */
export function scoreAnswer(elapsedMs, timerSeconds, speedBonus = true) {
  if (!speedBonus) return 1000;
  return Math.round(1000 * (1 - (0.5 * elapsedMs) / (timerSeconds * 1000)));
}

const settingsSchema = v.strictObject({
  showLeaderboard: v.optional(v.boolean()),
  timerMode: v.optional(v.picklist(['per_question', 'fixed'])),
  fixedTimerSeconds: v.optional(v.picklist(GAME_SETTINGS_CHOICES.fixedTimerSeconds)),
  readySeconds: v.optional(v.picklist(GAME_SETTINGS_CHOICES.readySeconds)),
  endWhenAllAnswered: v.optional(v.boolean()),
  autoAdvanceSeconds: v.optional(v.picklist(GAME_SETTINGS_CHOICES.autoAdvanceSeconds)),
  shuffleQuestions: v.optional(v.boolean()),
  shuffleOptions: v.optional(v.boolean()),
  speedBonus: v.optional(v.boolean()),
  allowLateJoin: v.optional(v.boolean()),
});

/** Validate a (possibly partial) settings payload and merge over defaults. */
export function parseQuizSettings(body, base = GAME_SETTINGS_DEFAULTS) {
  const parsed = run(settingsSchema, body);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { ...base, ...parsed.value } };
}

/** Merge a stored settings_json value over defaults; null/invalid -> defaults. */
export function readSettings(json) {
  if (!json) return { ...GAME_SETTINGS_DEFAULTS };
  try {
    return { ...GAME_SETTINGS_DEFAULTS, ...JSON.parse(json) };
  } catch {
    return { ...GAME_SETTINGS_DEFAULTS };
  }
}

/**
 * Leaderboard ordering: total score desc, then cumulative elapsed asc, then
 * alias. Input: `[{playerId, alias, score, totalElapsedMs}]`.
 */
export function orderLeaderboard(players) {
  return [...players].sort(
    (a, b) => b.score - a.score || a.totalElapsedMs - b.totalElapsedMs || a.alias.localeCompare(b.alias),
  );
}

/**
 * Normalize a Browser Run `quickAction('markdown')` result to trimmed Markdown.
 * The binding returns a Response whose JSON body is `{success, result}`; a
 * failed action, non-2xx status, or empty result yields ''.
 */
export async function readQuickActionMarkdown(result) {
  let value = result;
  if (value && typeof value.text === 'function' && 'ok' in value) {
    if (!value.ok) return '';
    const text = await value.text();
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
  }
  if (value && typeof value === 'object') {
    if (value.success === false) return '';
    value = value.result ?? value.markdown ?? '';
  }
  return typeof value === 'string' ? value.trim() : '';
}
