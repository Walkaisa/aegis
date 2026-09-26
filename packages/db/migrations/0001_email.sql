CREATE TYPE "public"."account_token_purpose" AS ENUM('password_reset', 'email_change');--> statement-breakpoint
CREATE TYPE "public"."smtp_security" AS ENUM('starttls', 'tls', 'none');--> statement-breakpoint
CREATE TABLE "account_tokens" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"purpose" "account_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"target_email" text,
	"target_email_normalized" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_tokens_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "account_tokens_target_email_check" CHECK (("account_tokens"."purpose" = 'email_change') = ("account_tokens"."target_email" IS NOT NULL)),
	CONSTRAINT "account_tokens_target_email_normalized_check" CHECK (("account_tokens"."target_email" IS NULL) = ("account_tokens"."target_email_normalized" IS NULL)),
	CONSTRAINT "account_tokens_expires_at_check" CHECK ("account_tokens"."expires_at" > "account_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"security" "smtp_security" NOT NULL,
	"username" text,
	"password_ciphertext" text,
	"from_name" text NOT NULL,
	"from_address" text NOT NULL,
	"reply_to" text,
	"allow_invalid_certificate" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_settings_singleton_check" CHECK ("email_settings"."id" = 1),
	CONSTRAINT "email_settings_host_check" CHECK (btrim("email_settings"."host") <> ''),
	CONSTRAINT "email_settings_port_check" CHECK ("email_settings"."port" BETWEEN 1 AND 65535),
	CONSTRAINT "email_settings_from_name_check" CHECK (btrim("email_settings"."from_name") <> ''),
	CONSTRAINT "email_settings_from_address_check" CHECK ("email_settings"."from_address" LIKE '%_@_%'),
	CONSTRAINT "email_settings_password_check" CHECK ("email_settings"."password_ciphertext" IS NULL OR "email_settings"."username" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_tokens_user_id_purpose_idx" ON "account_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "account_tokens_expires_at_idx" ON "account_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_tokens_pending_target_email_key" ON "account_tokens" USING btree ("target_email_normalized") WHERE "account_tokens"."consumed_at" IS NULL AND "account_tokens"."target_email_normalized" IS NOT NULL;