CREATE TABLE `track_points` (
	`id` integer PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`t` integer NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`alt` real,
	`accuracy_m` real,
	`speed_mps` real,
	`mocked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `track_points_workout_t_idx` ON `track_points` (`workout_id`,`t`);--> statement-breakpoint
CREATE TABLE `workout_pauses` (
	`id` integer PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_pauses_workout_idx` ON `workout_pauses` (`workout_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source` text DEFAULT 'gps' NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`timezone` text NOT NULL,
	`elapsed_s` integer,
	`moving_s` integer,
	`distance_m` real,
	`title` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`battery_start` real,
	`battery_end` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_status_idx` ON `workouts` (`status`);--> statement-breakpoint
CREATE INDEX `workouts_started_at_idx` ON `workouts` (`started_at`);