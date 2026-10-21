CREATE INDEX `browser_sessions_expires_at` ON `browser_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `device_codes_expires_at` ON `device_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `tokens_expires_at` ON `tokens` (`expires_at`);