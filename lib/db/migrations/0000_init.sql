CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`number` integer NOT NULL,
	`kind` text NOT NULL,
	`principle_id` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`fix` text NOT NULL,
	`severity` text NOT NULL,
	`confidence` text,
	`measurement_id` text,
	`region` text,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`box` text NOT NULL,
	`value` real NOT NULL,
	`threshold` real NOT NULL,
	`passes` integer NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_name_unique` ON `projects` (lower("name"));--> statement-breakpoint
CREATE TABLE `pushbacks` (
	`issue_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`status` text NOT NULL,
	`step` text NOT NULL,
	`error` text,
	`sources` text NOT NULL,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`metric` text,
	`threshold` real,
	`position` integer NOT NULL,
	`enabled` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`screenshot_path` text NOT NULL,
	`file_name` text DEFAULT '' NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`scale` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_project_name_unique` ON `versions` (`project_id`,lower("name"));