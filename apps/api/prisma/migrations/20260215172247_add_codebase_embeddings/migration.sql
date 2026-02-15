-- CreateTable
CREATE TABLE "codebase_embeddings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "language" VARCHAR(20) NOT NULL,
    "last_commit_sha" VARCHAR(40) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codebase_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codebase_index_status" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'idle',
    "last_indexed_at" TIMESTAMP(3),
    "last_commit_sha" VARCHAR(40),
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codebase_index_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codebase_embeddings_tenant_id_application_id_idx" ON "codebase_embeddings"("tenant_id", "application_id");

-- CreateIndex
CREATE INDEX "codebase_embeddings_application_id_file_path_idx" ON "codebase_embeddings"("application_id", "file_path");

-- CreateIndex
CREATE UNIQUE INDEX "codebase_embeddings_application_id_file_path_chunk_index_key" ON "codebase_embeddings"("application_id", "file_path", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "codebase_index_status_application_id_key" ON "codebase_index_status"("application_id");

-- AddForeignKey
ALTER TABLE "codebase_embeddings" ADD CONSTRAINT "codebase_embeddings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codebase_embeddings" ADD CONSTRAINT "codebase_embeddings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codebase_index_status" ADD CONSTRAINT "codebase_index_status_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (pgvector HNSW for cosine similarity search)
CREATE INDEX idx_codebase_embeddings_vector ON codebase_embeddings USING hnsw (embedding vector_cosine_ops);
