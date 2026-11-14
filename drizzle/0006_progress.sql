CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`target` real NOT NULL,
	`activity_type` text,
	`exercise_id` text,
	`last_achieved_period` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`start_week` text NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT false NOT NULL
);
