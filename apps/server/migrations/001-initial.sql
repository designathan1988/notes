CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS "user" (id text PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, email_verified boolean NOT NULL DEFAULT false, image text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS session (id text PRIMARY KEY, token text UNIQUE NOT NULL, expires_at timestamp NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, ip_address text, user_agent text, active_organization_id text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS account (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamp, refresh_token_expires_at timestamp, scope text, password text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS organization (id text PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL, logo text, metadata text, created_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS member (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, role text NOT NULL, created_at timestamp NOT NULL DEFAULT now(), UNIQUE(organization_id, user_id));
CREATE TABLE IF NOT EXISTS invitation (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, email text NOT NULL, role text, status text NOT NULL, expires_at timestamp NOT NULL, inviter_id text NOT NULL REFERENCES "user"(id), created_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pages (
  id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  parent_id text, title text NOT NULL, description text NOT NULL DEFAULT '', kind text NOT NULL DEFAULT 'document',
  visibility text NOT NULL DEFAULT 'workspace', created_by text NOT NULL REFERENCES "user"(id), position integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 1, generation integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,parent_id) REFERENCES pages(workspace_id,id),
  CHECK(kind IN ('document','database','record','canvas')), CHECK(visibility IN ('workspace','private')), CHECK(parent_id IS DISTINCT FROM id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pages'::regclass AND conname='pages_kind_check' AND pg_get_constraintdef(oid) NOT LIKE '%canvas%') THEN
    ALTER TABLE pages DROP CONSTRAINT pages_kind_check;
    ALTER TABLE pages ADD CONSTRAINT pages_kind_check CHECK(kind IN ('document','database','record','canvas'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pages_parent ON pages(workspace_id,parent_id,position);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS index_revision bigint NOT NULL DEFAULT 1;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS private_owner_id text REFERENCES "user"(id);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS cover jsonb;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_properties jsonb NOT NULL DEFAULT '{"fields":[],"values":{}}';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS template_root_id text REFERENCES pages(id);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS template_database_id text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS template_values jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS pages_template_roots ON pages(workspace_id,updated_at,id) WHERE template_root_id=id AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pages_tags ON pages USING GIN(tags);
CREATE TABLE IF NOT EXISTS documents (page_id text PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE, state bytea NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS document_checkpoints (id text PRIMARY KEY, page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE, state bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE document_checkpoints ADD COLUMN IF NOT EXISTS author_id text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE document_checkpoints ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '';
ALTER TABLE document_checkpoints ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'automatic';
ALTER TABLE document_checkpoints ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
ALTER TABLE document_checkpoints ALTER COLUMN version SET DEFAULT 0;
UPDATE document_checkpoints SET version=0 WHERE version=1 AND author_id IS NULL AND label='' AND kind='automatic';
CREATE INDEX IF NOT EXISTS document_checkpoints_page_created ON document_checkpoints(page_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS discussion_threads (
  id text PRIMARY KEY, page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  quote text NOT NULL DEFAULT '', resolved boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discussion_threads_page_updated ON discussion_threads(page_id,resolved,updated_at DESC,id);
CREATE TABLE IF NOT EXISTS discussion_messages (
  id text PRIMARY KEY, thread_id text NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  author_id text REFERENCES "user"(id) ON DELETE SET NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discussion_messages_thread_created ON discussion_messages(thread_id,created_at,id);
CREATE TABLE IF NOT EXISTS database_definitions (page_id text PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE, fields jsonb NOT NULL DEFAULT '[]');
ALTER TABLE database_definitions ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS records (page_id text PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE, database_id text NOT NULL REFERENCES database_definitions(page_id), values jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1);
ALTER TABLE records ADD COLUMN IF NOT EXISTS computed_values jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS records_database_page ON records(database_id,page_id);
CREATE TABLE IF NOT EXISTS table_views (id text PRIMARY KEY, database_id text NOT NULL REFERENCES database_definitions(page_id) ON DELETE CASCADE, name text NOT NULL, config jsonb NOT NULL DEFAULT '{}');
ALTER TABLE table_views ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS table_views_database_name ON table_views(database_id,name,id);
ALTER TABLE database_definitions ADD COLUMN IF NOT EXISTS views_revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS attachments (id text PRIMARY KEY, page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE, filename text NOT NULL, media_type text NOT NULL, size integer NOT NULL, object_key text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS search_projection (page_id text PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE, version bigint NOT NULL, body text NOT NULL DEFAULT '', tokens tsvector NOT NULL DEFAULT ''::tsvector);
CREATE INDEX IF NOT EXISTS search_tokens ON search_projection USING GIN(tokens);
CREATE INDEX IF NOT EXISTS page_title_trigrams ON pages USING GIN(title gin_trgm_ops);
CREATE TABLE IF NOT EXISTS link_projection (source_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE, target_id text NOT NULL, excerpt text NOT NULL DEFAULT '', PRIMARY KEY(source_id,target_id));
CREATE TABLE IF NOT EXISTS outbox (id bigserial PRIMARY KEY, page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE, version bigint NOT NULL, processed_at timestamptz);
CREATE INDEX IF NOT EXISTS pending_outbox ON outbox(page_id,version) WHERE processed_at IS NULL;
CREATE TABLE IF NOT EXISTS operation_keys (id text PRIMARY KEY, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS favorites (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE, PRIMARY KEY(user_id,page_id));
CREATE TABLE IF NOT EXISTS appearance_preferences (user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, revision integer NOT NULL DEFAULT 1, overrides jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS web_previews (id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE, generation integer NOT NULL, source jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS web_previews_actor_expiry ON web_previews(user_id,expires_at);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS appearance jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS beta_entitlements (workspace_id text PRIMARY KEY REFERENCES organization(id) ON DELETE CASCADE, plan text NOT NULL DEFAULT 'beta', storage_limit bigint NOT NULL DEFAULT 1073741824);
CREATE TABLE IF NOT EXISTS transfer_jobs (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES "user"(id), object_key text NOT NULL, archive_size integer NOT NULL, stage text NOT NULL DEFAULT 'pages', offset_value integer NOT NULL DEFAULT 0, mapping jsonb NOT NULL, warnings jsonb NOT NULL DEFAULT '[]', page_count integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
