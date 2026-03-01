-- Unify ticket embeddings from vector(3072) to vector(1536)
-- to match text-embedding-3-small used by codebase embeddings and API provider.
-- Existing embeddings are incompatible and must be re-generated.

-- Step 1: Drop the old column and recreate with new dimensions
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "tickets" ADD COLUMN "embedding" vector(1536);

-- Step 2: Re-create HNSW index for the new dimension (if it existed)
DROP INDEX IF EXISTS "tickets_embedding_hnsw_idx";
CREATE INDEX "tickets_embedding_hnsw_idx" ON "tickets" USING hnsw ("embedding" vector_cosine_ops);
