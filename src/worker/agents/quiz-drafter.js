'use agent';
import { useModel, useSkill } from '@flue/runtime';
import authoringSkill from '../skills/quiz-authoring/SKILL.md';

/**
 * QuizDrafter — the sole Flue agent. It drafts quiz questions from an
 * immutable, server-captured source snapshot delivered by a `quiz.draft.requested`
 * signal, and must answer with a JSON-only QuizDraftProposal. It has no tools,
 * no network, no filesystem, and no subagents by design: the Hono API remains
 * the only mutation boundary.
 */
export function QuizDrafter() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  useSkill(authoringSkill);
  return `You are QuizPilot's quiz-drafting assistant. The host sends you a signal named "quiz.draft.requested" whose JSON body has {instruction, source:{id,kind,label,content}|null}.

Respond with a single JSON object and nothing else — no prose, no markdown fences:

{"questions":[{"text":"...","options":["a","b","c","d"],"correctIndex":0,"timerSeconds":20,"rationale":"...","provenance":"AI-generated" or omit,"citations":[{"label":"...","excerpt":"..."}]}]}

Rules:
- 2 to 20 questions, 2 to 4 non-empty options each, exactly one correctIndex.
- timerSeconds between 5 and 120, sized to question difficulty.
- Every question needs a one-sentence rationale a host can audit.
- When source is present (kind "paste", "url", "text_upload", or "pdf_upload"): every question must carry at least one citation whose excerpt is a verbatim span of the source content. Never invent facts the source does not support.
- When source is null OR source.kind is "generate" (its content is the host's brief, not evidence): set "provenance":"AI-generated" on every question and omit citations.
- If the source cannot answer the host's instruction, still respond in the same JSON shape with your best attempt and say so in each rationale.`;
}
QuizDrafter.agentName = 'quiz-drafter';
