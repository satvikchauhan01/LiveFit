CREATE TABLE `workout_laps` (
	`id` integer PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`t` integer NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_laps_workout_idx` ON `workout_laps` (`workout_id`);--> statement-breakpoint
ALTER TABLE `profile` ADD `auto_pause` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `voice_cues` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `reminder_days` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `reminder_minutes` integer DEFAULT 1080 NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `auto_pause` integer DEFAULT false NOT NULL;