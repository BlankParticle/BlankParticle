CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`client_key` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text,
	`logo` text,
	`audience` text NOT NULL,
	`pii` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_apps_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `authorization_requests` (
	`id` text PRIMARY KEY,
	`stage` text NOT NULL,
	`user_id` integer,
	`redirect_uri` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text,
	`client_logo` text,
	`audience` text NOT NULL,
	`client_state` text NOT NULL,
	`code_challenge` text NOT NULL,
	`pii` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_authorization_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `browser_sessions` (
	`id` text PRIMARY KEY,
	`user_id` integer NOT NULL,
	`user_agent` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_browser_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `device_codes` (
	`device_code` text PRIMARY KEY,
	`user_code` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text,
	`client_logo` text,
	`audience` text NOT NULL,
	`pii` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_id` integer,
	`interval` integer NOT NULL,
	`last_polled_at` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_device_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tokens` (
	`jti` text PRIMARY KEY,
	`user_id` integer NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text,
	`client_logo` text,
	`audience` text NOT NULL,
	`pii` integer NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	CONSTRAINT `fk_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY,
	`login` text NOT NULL,
	`name` text,
	`picture` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_user_client_audience` ON `apps` (`user_id`,`client_key`,`audience`);--> statement-breakpoint
CREATE INDEX `authorization_requests_expires_at` ON `authorization_requests` (`expires_at`);--> statement-breakpoint
CREATE INDEX `browser_sessions_user_id` ON `browser_sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_codes_user_code` ON `device_codes` (`user_code`);--> statement-breakpoint
CREATE INDEX `tokens_user_id` ON `tokens` (`user_id`);