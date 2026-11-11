import { ERRORS, WS_ERRORS } from '@/shared/protocol.js';

const COPY = {
  [ERRORS.sourceUnreadable]:
    "Kitesurf couldn't read this page. It can't open pages behind a login or a bot check. Try another public page, or paste the text instead.",
  [ERRORS.agentRunFailed]: "The draft didn't finish. Try again, or rephrase your request.",
  [ERRORS.quizNotFound]: 'This quiz no longer exists.',
  [ERRORS.gameNotFound]: 'This game has ended or the code is wrong.',
  [ERRORS.quizNotEditable]: "Published quizzes can't be edited.",
  [ERRORS.bodyTooLarge]: 'That input is too large.',
  [ERRORS.invalidJson]: 'The request could not be read.',
  [WS_ERRORS.lateAnswer]: 'Time ran out before your answer arrived.',
  [WS_ERRORS.duplicateAnswer]: "You've already answered this question.",
  NETWORK: 'Connection lost. Reconnecting…',
};

export function errorMessage(e) {
  if (!e) return COPY.NETWORK;
  if (e.error === ERRORS.invalidInput) {
    return `Check ${e.field ?? 'the form'}: ${e.message ?? 'invalid input.'}`;
  }
  return COPY[e.error] ?? e.message ?? 'Something went wrong. Try again.';
}
