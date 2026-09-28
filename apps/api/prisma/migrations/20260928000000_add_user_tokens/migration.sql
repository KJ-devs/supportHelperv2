-- One-time email tokens (password reset, team invitation)
CREATE TABLE "user_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_tokens_token_hash_key" ON "user_tokens"("token_hash");
CREATE INDEX "user_tokens_user_id_type_idx" ON "user_tokens"("user_id", "type");

ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
