-- AlterTable (idempotent - column may already exist from previous migration)
DO $$ BEGIN
  ALTER TABLE "tickets" ADD COLUMN "reopen_token" VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_reopen_token_key" ON "tickets"("reopen_token");

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "ticket_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ticket_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
