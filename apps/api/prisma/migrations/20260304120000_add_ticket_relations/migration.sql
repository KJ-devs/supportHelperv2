-- CreateEnum
CREATE TYPE "TicketRelationType" AS ENUM ('duplicate', 'similar', 'related');

-- CreateTable
CREATE TABLE "ticket_relations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "source_ticket_id" UUID NOT NULL,
    "target_ticket_id" UUID NOT NULL,
    "relation_type" "TicketRelationType" NOT NULL,
    "created_by" VARCHAR(20) NOT NULL,
    "confidence" DECIMAL(3,2),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_relations_source_ticket_id_idx" ON "ticket_relations"("source_ticket_id");

-- CreateIndex
CREATE INDEX "ticket_relations_target_ticket_id_idx" ON "ticket_relations"("target_ticket_id");

-- CreateIndex
CREATE INDEX "ticket_relations_tenant_id_idx" ON "ticket_relations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_relations_source_ticket_id_target_ticket_id_relation__key" ON "ticket_relations"("source_ticket_id", "target_ticket_id", "relation_type");

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_source_ticket_id_fkey" FOREIGN KEY ("source_ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_target_ticket_id_fkey" FOREIGN KEY ("target_ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
