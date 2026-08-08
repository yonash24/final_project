-- Migration 0012: Chat search performance indexes
-- Additive only: no data, RPCs, RLS policies, or response shapes are changed.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text searches use leading-wildcard ILIKE predicates. Trigram indexes support
-- those predicates while the partial condition keeps inactive/unpublished rows
-- out of the indexes used by chat.
CREATE INDEX IF NOT EXISTS activities_chat_title_he_trgm_idx
    ON public.activities USING gin (title_he gin_trgm_ops)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS activities_chat_description_he_trgm_idx
    ON public.activities USING gin (description_he gin_trgm_ops)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS activities_chat_location_trgm_idx
    ON public.activities USING gin (location gin_trgm_ops)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS activities_chat_instructor_trgm_idx
    ON public.activities USING gin (instructor_name gin_trgm_ops)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS events_chat_title_trgm_idx
    ON public.events USING gin (title gin_trgm_ops)
    WHERE is_published = true;

CREATE INDEX IF NOT EXISTS events_chat_description_trgm_idx
    ON public.events USING gin (description gin_trgm_ops)
    WHERE is_published = true;

CREATE INDEX IF NOT EXISTS events_chat_category_trgm_idx
    ON public.events USING gin (category gin_trgm_ops)
    WHERE is_published = true;

CREATE INDEX IF NOT EXISTS events_chat_location_trgm_idx
    ON public.events USING gin (location gin_trgm_ops)
    WHERE is_published = true;

CREATE INDEX IF NOT EXISTS knowledge_base_chat_title_he_trgm_idx
    ON public.knowledge_base USING gin (title_he gin_trgm_ops)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS knowledge_base_chat_content_he_trgm_idx
    ON public.knowledge_base USING gin (content_he gin_trgm_ops)
    WHERE is_active = true;

-- Common structured chat filters.
CREATE INDEX IF NOT EXISTS activities_chat_active_title_idx
    ON public.activities (title_he)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS activities_chat_active_age_idx
    ON public.activities (target_age_group, min_age, max_age)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS activities_chat_active_price_idx
    ON public.activities (price)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS events_chat_published_date_idx
    ON public.events (event_date)
    WHERE is_published = true;

CREATE INDEX IF NOT EXISTS knowledge_base_chat_active_title_idx
    ON public.knowledge_base (title_he)
    WHERE is_active = true;

-- The chat RPCs order by cosine distance (<=>). HNSW supports nearest-neighbor
-- lookup for the vector columns used by Gemini embeddings. If the deployed
-- pgvector version does not support HNSW, replace these three indexes with the
-- supported pgvector ANN index type before applying this migration.
CREATE INDEX IF NOT EXISTS activities_chat_embedding_hnsw_idx
    ON public.activities USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_chat_embedding_hnsw_idx
    ON public.events USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS knowledge_base_chat_embedding_hnsw_idx
    ON public.knowledge_base USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
