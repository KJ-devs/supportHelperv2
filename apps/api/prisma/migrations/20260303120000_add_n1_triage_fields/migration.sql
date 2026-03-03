-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "n1_assessment" JSONB,
ADD COLUMN "n1_assessed_at" TIMESTAMP(3),
ADD COLUMN "n1_decision" VARCHAR(30);
