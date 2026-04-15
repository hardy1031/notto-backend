-- Remove order column from note_pieces (order is now implicit in S3 JSON array)
ALTER TABLE public.note_pieces DROP COLUMN "order";

-- Enforce 1:1 relationship between note_piece and context_object
ALTER TABLE public.context_objects
  ADD CONSTRAINT context_objects_note_piece_id_unique UNIQUE (note_piece_id);

-- Index for context_objects.note_piece_id lookups
-- (the UNIQUE constraint above already creates an implicit index, but listed explicitly for clarity)
CREATE INDEX idx_context_objects_note_piece_id ON public.context_objects(note_piece_id);
