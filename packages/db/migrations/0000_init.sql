CREATE TYPE "public"."signing_key_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."client_access_policy" AS ENUM('everyone', 'assigned');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('confidential', 'public');--> statement-breakpoint
CREATE TYPE "public"."pkce_policy" AS ENUM('required', 'optional', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."token_endpoint_auth_method" AS ENUM('client_secret_basic', 'client_secret_post', 'none');--> statement-breakpoint
CREATE TYPE "public"."account_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"outcome" text DEFAULT 'success' NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" bigint,
	"actor_label" text,
	"subject_user_id" bigint,
	"subject_label" text,
	"client_id" bigint,
	"client_label" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_events_severity_check" CHECK ("audit_events"."severity" IN ('info', 'notice', 'warning', 'error', 'critical')),
	CONSTRAINT "audit_events_outcome_check" CHECK ("audit_events"."outcome" IN ('success', 'failure')),
	CONSTRAINT "audit_events_source_check" CHECK ("audit_events"."source" IN ('admin', 'user', 'application', 'system')),
	CONSTRAINT "audit_events_event_type_check" CHECK ("audit_events"."event_type" ~ '^[a-z_]+(\.[a-z_]+)+$')
);
--> statement-breakpoint
CREATE TABLE "client_assignments" (
	"client_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_assignments_pkey" PRIMARY KEY("client_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "client_logos" (
	"client_id" bigint PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"image" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_logos_hash_check" CHECK ("client_logos"."hash" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE TABLE "cookie_keys" (
	"id" bigint PRIMARY KEY NOT NULL,
	"key_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_keys" (
	"kid" text PRIMARY KEY NOT NULL,
	"algorithm" text NOT NULL,
	"private_jwk_ciphertext" text NOT NULL,
	"status" "signing_key_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "signing_keys_retired_at_check" CHECK (("signing_keys"."status" = 'retired') = ("signing_keys"."retired_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "oidc_artifacts" (
	"model" text NOT NULL,
	"id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"grant_id" text,
	"user_code" text,
	"uid" text,
	"client_id" text,
	"account_id" text,
	"expires_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "oidc_artifacts_pkey" PRIMARY KEY("model","id")
);
--> statement-breakpoint
CREATE TABLE "oidc_clients" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"client_type" "client_type" NOT NULL,
	"token_endpoint_auth_method" "token_endpoint_auth_method" NOT NULL,
	"client_secret_ciphertext" text,
	"client_secret_rotated_at" timestamp with time zone,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[] DEFAULT '{}'::text[] NOT NULL,
	"allowed_scopes" text[] NOT NULL,
	"skip_consent" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"access_policy" "client_access_policy" DEFAULT 'everyone' NOT NULL,
	"pkce_policy" "pkce_policy" NOT NULL,
	"last_authorized_at" timestamp with time zone,
	"logo_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_clients_name_check" CHECK (btrim("oidc_clients"."name") <> ''),
	CONSTRAINT "oidc_clients_logo_hash_check" CHECK ("oidc_clients"."logo_hash" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "oidc_clients_secret_check" CHECK (("oidc_clients"."client_type" = 'public') = ("oidc_clients"."client_secret_ciphertext" IS NULL)),
	CONSTRAINT "oidc_clients_auth_method_check" CHECK (("oidc_clients"."client_type" = 'public') = ("oidc_clients"."token_endpoint_auth_method" = 'none')),
	CONSTRAINT "oidc_clients_pkce_policy_check" CHECK ("oidc_clients"."client_type" = 'confidential' OR "oidc_clients"."pkce_policy" = 'required'),
	CONSTRAINT "oidc_clients_redirect_uris_check" CHECK (cardinality("oidc_clients"."redirect_uris") >= 1),
	CONSTRAINT "oidc_clients_allowed_scopes_check" CHECK ('openid' = ANY("oidc_clients"."allowed_scopes") AND "oidc_clients"."allowed_scopes" <@ ARRAY['openid', 'profile', 'email']::text[])
);
--> statement-breakpoint
CREATE TABLE "oidc_consents" (
	"user_id" bigint NOT NULL,
	"client_id" bigint NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_consents_pkey" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_codes_user_id_code_hash_key" UNIQUE("user_id","code_hash")
);
--> statement-breakpoint
CREATE TABLE "session_applications" (
	"session_id" bigint NOT NULL,
	"client_id" bigint NOT NULL,
	"first_authorized_at" timestamp with time zone NOT NULL,
	"last_authorized_at" timestamp with time zone NOT NULL,
	CONSTRAINT "session_applications_pkey" PRIMARY KEY("session_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"authenticated_at" timestamp with time zone NOT NULL,
	"amr" text[] DEFAULT '{pwd}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "sessions_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "sessions_expires_at_check" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"instance_name" text NOT NULL,
	"session_ttl_seconds" integer NOT NULL,
	"audit_retention_days" integer DEFAULT 180 NOT NULL,
	"encryption_key_check" text NOT NULL,
	"setup_completed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_singleton_check" CHECK ("system_settings"."id" = 1),
	CONSTRAINT "system_settings_instance_name_check" CHECK (btrim("system_settings"."instance_name") <> ''),
	CONSTRAINT "system_settings_session_ttl_check" CHECK ("system_settings"."session_ttl_seconds" BETWEEN 86400 AND 7776000),
	CONSTRAINT "system_settings_audit_retention_check" CHECK ("system_settings"."audit_retention_days" BETWEEN 1 AND 3650)
);
--> statement-breakpoint
CREATE TABLE "user_avatars" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"image" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_avatars_hash_check" CHECK ("user_avatars"."hash" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "account_role" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_changed_at" timestamp with time zone NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"avatar_hash" text,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"totp_label" text,
	"totp_last_counter" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_normalized_key" UNIQUE("email_normalized"),
	CONSTRAINT "users_email_normalized_check" CHECK ("users"."email_normalized" = lower("users"."email_normalized") AND "users"."email_normalized" = btrim("users"."email_normalized") AND "users"."email_normalized" <> ''),
	CONSTRAINT "users_display_name_check" CHECK (btrim("users"."display_name") <> ''),
	CONSTRAINT "users_avatar_hash_check" CHECK ("users"."avatar_hash" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "users_totp_enabled_check" CHECK ("users"."totp_enabled_at" IS NULL OR "users"."totp_secret" IS NOT NULL),
	CONSTRAINT "users_totp_label_check" CHECK (btrim("users"."totp_label") <> '' AND char_length("users"."totp_label") <= 64)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_client_id_oidc_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oidc_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_client_id_oidc_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oidc_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_logos" ADD CONSTRAINT "client_logos_client_id_oidc_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oidc_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_consents" ADD CONSTRAINT "oidc_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_consents" ADD CONSTRAINT "oidc_consents_client_id_oidc_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oidc_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_applications" ADD CONSTRAINT "session_applications_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_applications" ADD CONSTRAINT "session_applications_client_id_oidc_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oidc_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_event_type_occurred_at_idx" ON "audit_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_severity_occurred_at_idx" ON "audit_events" USING btree ("severity","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_outcome_occurred_at_idx" ON "audit_events" USING btree ("outcome","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_source_occurred_at_idx" ON "audit_events" USING btree ("source","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_subject_user_id_idx" ON "audit_events" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "client_assignments_user_id_idx" ON "client_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_keys_single_active_idx" ON "signing_keys" USING btree ("status") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "oidc_artifacts_grant_id_idx" ON "oidc_artifacts" USING btree ("grant_id") WHERE grant_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oidc_artifacts_uid_idx" ON "oidc_artifacts" USING btree ("model","uid") WHERE uid IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oidc_artifacts_user_code_idx" ON "oidc_artifacts" USING btree ("model","user_code") WHERE user_code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oidc_artifacts_client_id_idx" ON "oidc_artifacts" USING btree ("client_id") WHERE client_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oidc_artifacts_account_id_idx" ON "oidc_artifacts" USING btree ("account_id") WHERE account_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "oidc_artifacts_expires_at_idx" ON "oidc_artifacts" USING btree ("expires_at") WHERE expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "session_applications_client_id_idx" ON "session_applications" USING btree ("client_id","last_authorized_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_role_enabled_idx" ON "users" USING btree ("role","enabled");