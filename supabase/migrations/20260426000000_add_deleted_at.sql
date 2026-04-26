-- Add deleted_at for soft delete (tombstone sync) to notebooks, notes, and quizzes
ALTER TABLE public.notebooks ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.notes ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.quizzes ADD COLUMN deleted_at TIMESTAMPTZ;
