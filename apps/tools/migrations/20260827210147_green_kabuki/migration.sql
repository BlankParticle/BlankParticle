CREATE TABLE `email_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`received_at` integer NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`outcome` text NOT NULL,
	`forwarded_to` text,
	`rule_id` text
);
--> statement-breakpoint
CREATE TABLE `email_rules` (
	`id` text PRIMARY KEY,
	`zone` text NOT NULL,
	`address` text NOT NULL,
	`action_type` text NOT NULL,
	`action_to` text,
	`enabled` integer DEFAULT true NOT NULL,
	`note` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_zone_defaults` (
	`zone` text PRIMARY KEY,
	`action_type` text NOT NULL,
	`action_to` text
);
--> statement-breakpoint
CREATE TABLE `pending_logins` (
	`state` text PRIMARY KEY,
	`code_verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`return_to` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_files` (
	`share_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`type` text NOT NULL,
	`hash` text NOT NULL,
	`uploaded_at` integer,
	CONSTRAINT `share_files_pk` PRIMARY KEY(`share_id`, `name`),
	CONSTRAINT `fk_share_files_share_id_shares_id_fk` FOREIGN KEY (`share_id`) REFERENCES `shares`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY,
	`owner` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `site_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`site_slug` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`type` text NOT NULL,
	`etag` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_site_files_site_slug_sites_slug_fk` FOREIGN KEY (`site_slug`) REFERENCES `sites`(`slug`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`slug` text PRIMARY KEY,
	`owner` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_activity_received_at` ON `email_activity` (`received_at`);--> statement-breakpoint
CREATE INDEX `email_rules_zone` ON `email_rules` (`zone`);--> statement-breakpoint
CREATE INDEX `pending_logins_expires_at` ON `pending_logins` (`expires_at`);--> statement-breakpoint
CREATE INDEX `shares_owner` ON `shares` (`owner`);--> statement-breakpoint
CREATE INDEX `shares_expires_at` ON `shares` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_files_site_slug_path` ON `site_files` (`site_slug`,`path`);--> statement-breakpoint
CREATE INDEX `sites_owner` ON `sites` (`owner`);