import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readConversionMarkdown,
  parseQuizSettings,
  readSettings,
  parseHostBrief,
  parseSourceUrl,
  parseQuizProposal,
  parseAlias,
  parseJsonBody,
  parseAnswerMessage,
  scoreAnswer,
  orderLeaderboard,
  AI_PROVENANCE,
} from '../../src/worker/domain.js';
import { ERRORS } from '../../src/shared/protocol.js';

const citation = { label: 'Doc', excerpt: 'verbatim excerpt' };
const question = (over = {}) => ({
  text: 'What is 2+2?',
  options: ['3', '4'],
  correctIndex: 1,
  timerSeconds: 20,
  rationale: 'Arithmetic.',
  citations: [citation],
  ...over,
});

test('invalid JSON bodies are rejected with INVALID_JSON', () => {
  assert.equal(parseJsonBody('{nope').code, ERRORS.invalidJson);
  assert.equal(parseJsonBody('').code, ERRORS.invalidJson);
});

test('host brief requires title, audience, learningGoal', () => {
  assert.equal(parseHostBrief({ title: 'T', audience: 'A', learningGoal: 'G' }).ok, true);
  assert.equal(parseHostBrief({ title: '', audience: 'A', learningGoal: 'G' }).ok, false);
  assert.equal(parseHostBrief({ title: 'T' }).code, ERRORS.invalidInput);
});

test('source URLs reject http, credentials, localhost, and private IPs', () => {
  for (const url of [
    'http://example.com',
    'https://user:pw@example.com',
    'https://localhost/x',
    'https://foo.localhost/x',
    'https://127.0.0.1/x',
    'https://10.1.2.3/x',
    'https://192.168.1.1/x',
    'https://172.16.0.1/x',
    'https://169.254.1.1/x',
    'https://[::1]/x',
    'https://0.0.0.0/x',
  ]) {
    const r = parseSourceUrl({ url });
    assert.equal(r.ok, false, url);
    assert.equal(r.code, ERRORS.invalidInput);
  }
  assert.equal(parseSourceUrl({ url: 'https://example.com/page' }).ok, true);
});

test('proposals: bounds on count, options, timer, correctIndex', () => {
  const base = { questions: [question(), question({ text: 'Q2?' })] };
  assert.equal(parseQuizProposal(base, 'paste').ok, true);

  assert.equal(parseQuizProposal({ questions: [question()] }, 'paste').ok, false, 'need >=2');
  const many = { questions: Array.from({ length: 21 }, (_, i) => question({ text: `Q${i}` })) };
  assert.equal(parseQuizProposal(many, 'paste').ok, false, 'need <=20');

  assert.equal(parseQuizProposal({ questions: [question({ options: ['only'] }), question()] }, 'paste').ok, false);
  assert.equal(parseQuizProposal({ questions: [question({ options: ['a', 'b', 'c', 'd', 'e'] }), question()] }, 'paste').ok, false);
  assert.equal(parseQuizProposal({ questions: [question({ timerSeconds: 4 }), question()] }, 'paste').ok, false);
  assert.equal(parseQuizProposal({ questions: [question({ timerSeconds: 121 }), question()] }, 'paste').ok, false);
  assert.equal(parseQuizProposal({ questions: [question({ correctIndex: 2 }), question()] }, 'paste').ok, false);
});

test('sourced proposals require citations; missing citations rejected', () => {
  const noCite = { questions: [question({ citations: [] }), question()] };
  assert.equal(parseQuizProposal(noCite, 'url').ok, false);
});

test('generate proposals require AI-generated provenance and no citations', () => {
  const good = { questions: [question({ citations: undefined, provenance: AI_PROVENANCE }), question({ citations: undefined, provenance: AI_PROVENANCE })] };
  assert.equal(parseQuizProposal(good, 'generate').ok, true);

  // A generated proposal missing provenance is rejected.
  const missing = { questions: [question({ citations: undefined, provenance: undefined }), question({ citations: undefined, provenance: AI_PROVENANCE })] };
  assert.equal(parseQuizProposal(missing, 'generate').ok, false);

  // Citations on a generated quiz are rejected.
  const cited = { questions: [question({ provenance: AI_PROVENANCE }), question({ provenance: AI_PROVENANCE })] };
  assert.equal(parseQuizProposal(cited, 'generate').ok, false);
});

test('malformed proposals are rejected', () => {
  assert.equal(parseQuizProposal(null, 'paste').ok, false);
  assert.equal(parseQuizProposal({ questions: 'nope' }, 'paste').ok, false);
  assert.equal(parseQuizProposal({ questions: [question({ text: '  ' }), question()] }, 'paste').ok, false);
});

test('alias bounds', () => {
  assert.equal(parseAlias({ alias: 'Ada' }).ok, true);
  assert.equal(parseAlias({ alias: '' }).ok, false);
  assert.equal(parseAlias({ alias: 'x'.repeat(31) }).ok, false);
});

test('answer messages validate option index range', () => {
  assert.equal(parseAnswerMessage({ type: 'answer', optionIndex: 1 }, 4).ok, true);
  assert.equal(parseAnswerMessage({ type: 'answer', optionIndex: 4 }, 4).code, 'OPTION_OUT_OF_RANGE');
  assert.equal(parseAnswerMessage({ type: 'answer', optionIndex: -1 }, 4).code, 'OPTION_OUT_OF_RANGE');
  assert.equal(parseAnswerMessage({ type: 'answer', optionIndex: 1.5 }, 4).code, 'OPTION_OUT_OF_RANGE');
});

test('scoring: faster correct answers score more, floor at half credit', () => {
  assert.equal(scoreAnswer(0, 20), 1000);
  assert.equal(scoreAnswer(10000, 20), 750);
  assert.equal(scoreAnswer(19999, 20), 500);
});

test('leaderboard ordering: score desc, elapsed asc, alias', () => {
  const ordered = orderLeaderboard([
    { playerId: 'c', alias: 'Zed', score: 800, totalElapsedMs: 5000 },
    { playerId: 'a', alias: 'Bob', score: 900, totalElapsedMs: 9000 },
    { playerId: 'b', alias: 'Amy', score: 900, totalElapsedMs: 9000 },
    { playerId: 'd', alias: 'Dan', score: 900, totalElapsedMs: 12000 },
  ]);
  assert.deepEqual(ordered.map((p) => p.playerId), ['b', 'a', 'd', 'c']);
});

test('readQuickActionMarkdown normalizes Browser Run results', async () => {
  const { readQuickActionMarkdown } = await import('../../src/worker/domain.js');
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  assert.equal(await readQuickActionMarkdown(json({ success: true, result: '  # Example Domain\n' })), '# Example Domain');
  assert.equal(await readQuickActionMarkdown(json({ success: false, errors: [{ message: 'blocked' }] })), '');
  assert.equal(await readQuickActionMarkdown(json({ success: true, result: '   ' })), '');
  assert.equal(await readQuickActionMarkdown(json({ success: true, result: '# x' }, 500)), '');
  assert.equal(await readQuickActionMarkdown(new Response('# Raw markdown')), '# Raw markdown');
  assert.equal(await readQuickActionMarkdown({ success: true, result: '# Obj' }), '# Obj');
  assert.equal(await readQuickActionMarkdown(null), '');
});

test('readConversionMarkdown normalizes toMarkdown results', () => {
  assert.equal(readConversionMarkdown({ format: 'markdown', data: '  hello  ' }), 'hello');
  assert.equal(readConversionMarkdown([{ format: 'markdown', data: 'first' }, { data: 'second' }]), 'first');
  assert.equal(readConversionMarkdown({ format: 'error', data: 'x' }), '');
  assert.equal(readConversionMarkdown({ format: 'markdown', data: '   ' }), '');
  assert.equal(readConversionMarkdown({ format: 'markdown' }), '');
  assert.equal(readConversionMarkdown(null), '');
  const envelope = (contents) => `# a.pdf\n## Metadata\n- PDFFormatVersion=1.4\n\n## Contents\n${contents}`;
  assert.equal(readConversionMarkdown({ format: 'markdown', data: envelope('### Page 1\nHello QuizPilot') }), '### Page 1\nHello QuizPilot');
  assert.equal(readConversionMarkdown({ format: 'markdown', data: envelope('### Page 1\n\n### Page 2\n') }), '');
});

test('parseQuizSettings merges and validates', () => {
  assert.deepEqual(parseQuizSettings({}).value, { showLeaderboard: true, timerMode: 'per_question', fixedTimerSeconds: 20, readySeconds: 3, endWhenAllAnswered: true, autoAdvanceSeconds: 0, shuffleQuestions: false, shuffleOptions: false, speedBonus: true, allowLateJoin: true });
  assert.equal(parseQuizSettings({ autoAdvanceSeconds: 8, speedBonus: false }).value.speedBonus, false);
  assert.equal(parseQuizSettings({ nope: 1 }).ok, false);
  assert.equal(parseQuizSettings({ fixedTimerSeconds: 25 }).ok, false);
  assert.equal(parseQuizSettings({ readySeconds: 4 }).ok, false);
  assert.equal(parseQuizSettings({ timerMode: 'x' }).ok, false);
  assert.equal(readSettings(null).readySeconds, 3);
  assert.equal(readSettings('{bad').speedBonus, true);
  assert.equal(readSettings('{"speedBonus":false}').speedBonus, false);
  const merged = parseQuizSettings({ speedBonus: false }, parseQuizSettings({ readySeconds: 0 }).value);
  assert.equal(merged.value.readySeconds, 0);
  assert.equal(merged.value.speedBonus, false);
});
test('scoreAnswer flat when speedBonus off', () => {
  assert.equal(scoreAnswer(0, 20, false), 1000);
  assert.equal(scoreAnswer(19000, 20, false), 1000);
});
