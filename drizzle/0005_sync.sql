CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `exercises` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `exercises` ADD `dirty` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `analytics_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `dirty` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `elevation_gain_m` real;--> statement-breakpoint
ALTER TABLE `workouts` ADD `calories_est` real;--> statement-breakpoint
ALTER TABLE `workouts` ADD `visibility` text DEFAULT 'only_me' NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `extras` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `dirty` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `workouts_dirty_idx` ON `workouts` (`dirty`);