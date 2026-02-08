-- ============================================
-- PostgreSQL initialization script
-- Runs on first container startup only
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions initialized successfully';
    RAISE NOTICE '  - uuid-ossp: UUID generation';
    RAISE NOTICE '  - vector: pgvector for embeddings';
    RAISE NOTICE '  - pg_trgm: Trigram similarity for fuzzy search';
END $$;
