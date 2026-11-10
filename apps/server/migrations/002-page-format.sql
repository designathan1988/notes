-- A page of kind 'document' is written in one of two formats: 'blocks' (the Page type people
-- see: text in blocks) or 'web' (the Document type: a free-form page). The format is fixed
-- when the page is created from its content.
ALTER TABLE pages ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'blocks';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pages'::regclass AND conname='pages_format_check') THEN
    ALTER TABLE pages ADD CONSTRAINT pages_format_check CHECK(format IN ('blocks','web'));
  END IF;
END $$;
