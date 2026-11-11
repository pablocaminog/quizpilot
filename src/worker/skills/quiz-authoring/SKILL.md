---
name: quiz-authoring
description: Author assessable quiz questions that cite captured evidence.
---

# Quiz authoring contract

- Write questions that a learner can actually answer from the material — one
  unambiguous correct option, plausible distractors, no "all of the above".
- Match the difficulty the host requests and the stated audience.
- Cite the exact captured evidence: each `citations[].excerpt` must be a
  verbatim span of the provided source content, with a short `label`.
- Reject unsupported claims: if the source does not contain the fact a
  question asserts, do not write that question.
- Avoid ambiguous distractors: options must be mutually exclusive.
- When the selected source cannot answer the host's brief, say so explicitly
  in the rationale rather than fabricating coverage.
- For `generate` sources (no captured material), mark provenance
  `AI-generated` and stay within common knowledge.
