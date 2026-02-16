-- AlterTable: Update SsoConfig to use Text for config and add config_iv
-- This migration updates the encryption storage for SSO configuration

-- First, add the config_iv column (allowing NULL temporarily)
ALTER TABLE "sso_config" ADD COLUMN "config_iv" VARCHAR(32);

-- Convert existing Json config to empty string (since we're changing encryption approach)
-- Note: Any existing SSO configs will need to be reconfigured
ALTER TABLE "sso_config" ALTER COLUMN "config" TYPE TEXT;
ALTER TABLE "sso_config" ALTER COLUMN "config" DROP DEFAULT;
ALTER TABLE "sso_config" ALTER COLUMN "config" SET DEFAULT '';

-- Update existing rows to have empty config and a dummy IV
UPDATE "sso_config" SET "config" = '', "config_iv" = '00000000000000000000000000000000' WHERE "config_iv" IS NULL;

-- Make config_iv NOT NULL now that we've updated existing rows
ALTER TABLE "sso_config" ALTER COLUMN "config_iv" SET NOT NULL;
