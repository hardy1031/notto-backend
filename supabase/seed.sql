-- Seed data for local development
-- Test user credentials: test@example.com / password123

-- Fixed UUIDs for reproducibility
DO $$
DECLARE
  v_user_id     UUID := '00000000-0000-0000-0000-000000000001';
  v_notebook_id UUID := '00000000-0000-0000-0000-000000000010';
  v_note_id     UUID := '00000000-0000-0000-0000-000000000020';
  v_piece_id    UUID := '00000000-0000-0000-0000-000000000030';
  v_co_id_1     UUID := '00000000-0000-0000-0000-000000000040';
  v_co_id_2     UUID := '00000000-0000-0000-0000-000000000041';
  v_quiz_id_1   UUID := '00000000-0000-0000-0000-000000000050';
  v_quiz_id_2   UUID := '00000000-0000-0000-0000-000000000051';
  v_quiz_id_3   UUID := '00000000-0000-0000-0000-000000000052';
  v_run_id      UUID := '00000000-0000-0000-0000-000000000060';
BEGIN

-- auth.users (Supabase Auth internal table)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role
) VALUES (
  v_user_id,
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- public.users (trigger creates this automatically, but update with real values)
UPDATE public.users SET
  user_name = 'Test User',
  first_language = 'ja',
  target_language = 'ko',
  updated_at = NOW()
WHERE id = v_user_id;

-- notebooks
INSERT INTO public.notebooks (id, user_id, name, created_at, updated_at) VALUES
  (v_notebook_id, v_user_id, 'スラング', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- notes
INSERT INTO public.notes (id, notebook_id, s3_key, created_at, updated_at) VALUES
  (v_note_id, v_notebook_id, v_user_id || '/' || v_notebook_id || '/' || v_note_id || '.md', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- note_pieces (1 piece per note in MVP)
INSERT INTO public.note_pieces (id, note_id, "order", created_at) VALUES
  (v_piece_id, v_note_id, 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- context_objects
INSERT INTO public.context_objects (
  id, note_piece_id, note_id, expression, base_meaning, actual_nuance,
  tone, formality, is_slang, example_dialogue, created_at, updated_at
) VALUES
  (
    v_co_id_1, v_piece_id, v_note_id,
    '겠냐?',
    'Do you think ~?',
    'Closer to "You really think that?" / "No way" — strong disbelief',
    'rough', 'casual', true,
    '[{"speaker":"A","text":"이거 내가 할 수 있겠지?"},{"speaker":"B","text":"네가 하겠냐?"}]',
    NOW(), NOW()
  ),
  (
    v_co_id_2, v_piece_id, v_note_id,
    '무슨 소리야',
    'What are you talking about?',
    'Dismissive — implies the other person said something absurd',
    'blunt', 'casual', false,
    '[{"speaker":"A","text":"나 오늘 100점 맞았어"},{"speaker":"B","text":"무슨 소리야, 진짜?"}]',
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- quizzes
INSERT INTO public.quizzes (
  id, context_object_id, type, question_sentence, answer, created_at, updated_at
) VALUES
  (
    v_quiz_id_1, v_co_id_1,
    'choose_context',
    '「マジでそうだと思うん？」を韓国語で？',
    '겠냐?',
    NOW(), NOW()
  ),
  (
    v_quiz_id_2, v_co_id_1,
    'fill_metadata',
    '겠냐? のフォーマリティは？',
    'casual',
    NOW(), NOW()
  ),
  (
    v_quiz_id_3, v_co_id_2,
    'choose_context',
    '「何言ってんの？」を韓国語で？',
    '무슨 소리야',
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- quiz_run (completed)
INSERT INTO public.quiz_runs (id, user_id, started_at, completed_at) VALUES
  (v_run_id, v_user_id, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '5 minutes')
ON CONFLICT (id) DO NOTHING;

-- quiz_records
INSERT INTO public.quiz_records (
  id, quiz_run_id, quiz_id, user_answer, is_correct, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000070', v_run_id, v_quiz_id_1, '겠냐?',     true,  NOW() - INTERVAL '9 minutes'),
  ('00000000-0000-0000-0000-000000000071', v_run_id, v_quiz_id_2, 'informal',  false, NOW() - INTERVAL '8 minutes'),
  ('00000000-0000-0000-0000-000000000072', v_run_id, v_quiz_id_3, '무슨 소리야', true,  NOW() - INTERVAL '7 minutes')
ON CONFLICT (id) DO NOTHING;

END $$;
