-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create quizzes table
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  title TEXT,
  questions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Create flashcard_sets table
CREATE TABLE flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  title TEXT,
  cards JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT UNIQUE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id),
  host_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'lobby',
  current_question_index INTEGER DEFAULT 0,
  question_start_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Create participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  display_name TEXT,
  photo_url TEXT,
  score INTEGER DEFAULT 0,
  last_answer_correct BOOLEAN,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Create responses table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES users(id),
  question_index INTEGER,
  answer_index INTEGER,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_sessions_pin ON sessions(pin);
CREATE INDEX idx_sessions_host ON sessions(host_id);
CREATE INDEX idx_responses_session ON responses(session_id);
CREATE INDEX idx_participants_session ON participants(session_id);

-- Enable realtime for sessions, participants, and responses
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
