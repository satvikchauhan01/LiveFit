ALTER TABLE "live_shares" ADD COLUMN "write_key_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "live_shares" ADD COLUMN "trail" jsonb DEFAULT '[]'::jsonb NOT NULL;