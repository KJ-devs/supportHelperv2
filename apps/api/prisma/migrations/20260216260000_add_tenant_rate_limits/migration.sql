-- Migration: Add tenant rate limits configuration
-- Description: Adds rate limit presets to tenant settings based on plan

-- Update existing tenants with default rate limits based on their plan
UPDATE "tenants"
SET "settings" = jsonb_set(
  COALESCE("settings"::jsonb, '{}'::jsonb),
  '{rateLimits}',
  CASE
    WHEN "plan" = 'free' THEN '{"requestsPerMinute": 30, "requestsPerHour": 1000}'::jsonb
    WHEN "plan" = 'pro' THEN '{"requestsPerMinute": 200, "requestsPerHour": 10000}'::jsonb
    WHEN "plan" = 'enterprise' THEN '{"requestsPerMinute": 1000, "requestsPerHour": 50000}'::jsonb
    ELSE '{"requestsPerMinute": 100, "requestsPerHour": 5000}'::jsonb
  END
)
WHERE "settings"::jsonb -> 'rateLimits' IS NULL;

-- Comment on the settings field to document rate limits structure
COMMENT ON COLUMN "tenants"."settings" IS 'JSON settings for tenant configuration. rateLimits: { requestsPerMinute: number, requestsPerHour: number }';
