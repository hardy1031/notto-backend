-- users (application-managed profile linked to auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  first_language VARCHAR(10) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- trigger: auto-create users row when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, user_name, first_language, target_language, created_at, updated_at)
  VALUES (NEW.id, '', '', '', NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- notebooks
CREATE TABLE public.notebooks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_notebooks_user_id ON public.notebooks(user_id);

-- notes
CREATE TABLE public.notes (
  id UUID PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  s3_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_notes_notebook_id ON public.notes(notebook_id);

-- note_pieces
CREATE TABLE public.note_pieces (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_note_pieces_note_id ON public.note_pieces(note_id);

-- context_objects
CREATE TABLE public.context_objects (
  id UUID PRIMARY KEY,
  note_piece_id UUID NOT NULL REFERENCES public.note_pieces(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  expression TEXT NOT NULL,
  base_meaning TEXT NOT NULL,
  actual_nuance TEXT NOT NULL,
  tone VARCHAR(50) NOT NULL,
  formality VARCHAR(50) NOT NULL CHECK (formality IN ('casual', 'neutral', 'formal')),
  is_slang BOOLEAN NOT NULL,
  example_dialogue JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_context_objects_note_id ON public.context_objects(note_id);

-- quizzes
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY,
  context_object_id UUID NOT NULL REFERENCES public.context_objects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  question_sentence TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_quizzes_context_object_id ON public.quizzes(context_object_id);

-- quiz_runs
CREATE TABLE public.quiz_runs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_quiz_runs_user_id ON public.quiz_runs(user_id);

-- quiz_records
CREATE TABLE public.quiz_records (
  id UUID PRIMARY KEY,
  quiz_run_id UUID NOT NULL REFERENCES public.quiz_runs(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_quiz_records_quiz_run_id ON public.quiz_records(quiz_run_id);
CREATE INDEX idx_quiz_records_quiz_id ON public.quiz_records(quiz_id);
