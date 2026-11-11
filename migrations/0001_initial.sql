CREATE TABLE host_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  host_session_id TEXT NOT NULL REFERENCES host_sessions(token_hash),
  title TEXT NOT NULL,
  audience TEXT NOT NULL,
  learning_goal TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_url TEXT
) STRICT;
CREATE INDEX quizzes_owner ON quizzes(host_session_id, updated_at DESC);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  kind TEXT NOT NULL CHECK (kind IN ('paste','url','text_upload','generate')),
  label TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  url TEXT,
  captured_at INTEGER,
  byte_length INTEGER NOT NULL,
  char_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sources_quiz ON sources(quiz_id, created_at DESC);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  timer_seconds INTEGER NOT NULL,
  rationale TEXT NOT NULL,
  provenance TEXT NOT NULL,
  citations_json TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX questions_quiz_position ON questions(quiz_id, position);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('lobby','question_open','question_closed','finished')),
  created_at INTEGER NOT NULL,
  finished_at INTEGER
) STRICT;
CREATE INDEX games_join_code ON games(join_code);

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  alias TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  total_elapsed_ms INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL
) STRICT;
CREATE INDEX players_game ON players(game_id);

CREATE TABLE answers (
  game_id TEXT NOT NULL REFERENCES games(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  question_position INTEGER NOT NULL,
  received_at_ms INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  selected_index INTEGER NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0,1)),
  score INTEGER NOT NULL,
  PRIMARY KEY (game_id, player_id, question_position)
) STRICT;
