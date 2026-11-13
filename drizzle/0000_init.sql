CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`distance_unit` text DEFAULT 'km' NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`weight_kg` real,
	`onboarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
