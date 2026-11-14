CREATE SEQUENCE "public"."sync_change_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"install_id" text NOT NULL,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"app_version" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_docs" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"id" text NOT NULL,
	"body" jsonb NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"change_seq" bigint DEFAULT nextval('sync_change_seq') NOT NULL,
	CONSTRAINT "user_docs_user_id_kind_id_pk" PRIMARY KEY("user_id","kind","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" text DEFAULT '' NOT NULL,
	"username" text,
	"bio" text DEFAULT '' NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp with time zone,
	"pro_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint,
	"timezone" text NOT NULL,
	"elapsed_s" integer,
	"moving_s" integer,
	"distance_m" double precision,
	"volume_kg" double precision,
	"elevation_gain_m" double precision,
	"calories_est" double precision,
	"auto_pause" boolean DEFAULT false NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'only_me' NOT NULL,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detail" jsonb NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"change_seq" bigint DEFAULT nextval('sync_change_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_docs" ADD CONSTRAINT "user_docs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_docs_user_seq_idx" ON "user_docs" USING btree ("user_id","change_seq");--> statement-breakpoint
CREATE INDEX "workouts_user_seq_idx" ON "workouts" USING btree ("user_id","change_seq");--> statement-breakpoint
CREATE INDEX "workouts_user_started_idx" ON "workouts" USING btree ("user_id","started_at");