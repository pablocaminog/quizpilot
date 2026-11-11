PRAGMA defer_foreign_keys = true;

CREATE TABLE sources_new (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  kind TEXT NOT NULL CHECK (kind IN ('paste','url','text_upload','pdf_upload','generate')),
  label TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  url TEXT,
  captured_at INTEGER,
  byte_length INTEGER NOT NULL,
  char_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

INSERT INTO sources_new (id, quiz_id, kind, label, r2_key, url, captured_at, byte_length, char_count, created_at)
  SELECT id, quiz_id, kind, label, r2_key, url, captured_at, byte_length, char_count, created_at FROM sources;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

CREATE INDEX sources_quiz ON sources(quiz_id, created_at DESC);
