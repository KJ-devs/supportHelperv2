-- AlterTable: Update SsoConfig to use Text for config and add config_iv
-- This migration is idempotent - changes may already exist from initial sso_config creation

-- Add config_iv column if not exists
DO $$ BEGIN
  ALTER TABLE "sso_config" ADD COLUMN "config_iv" VARCHAR(32);
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

-- Convert config column to TEXT if needed (safe to re-run)
ALTER TABLE "sso_config" ALTER COLUMN "config" TYPE TEXT;
ALTER TABLE "sso_config" ALTER COLUMN "config" DROP DEFAULT;
ALTER TABLE "sso_config" ALTER COLUMN "config" SET DEFAULT '';

-- Update existing rows to have empty config and a dummy IV where missing
UPDATE "sso_config" SET "config" = '', "config_iv" = '00000000000000000000000000000000' WHERE "config_iv" IS NULL;

-- Make config_iv NOT NULL
ALTER TABLE "sso_config" ALTER COLUMN "config_iv" SET NOT NULL;
