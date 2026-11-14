CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`muscle_group` text NOT NULL,
	`equipment` text NOT NULL,
	`log_type` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `strength_sets` (
	`id` integer PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_order` integer NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`duration_s` integer,
	`completed_at` integer,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `strength_sets_workout_idx` ON `strength_sets` (`workout_id`);--> statement-breakpoint
CREATE INDEX `strength_sets_exercise_idx` ON `strength_sets` (`exercise_id`);--> statement-breakpoint
ALTER TABLE `profile` ADD `rest_seconds` integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `volume_kg` real;