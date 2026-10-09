ALTER TABLE `tasks` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `checklists` DROP COLUMN `start_date`;--> statement-breakpoint
ALTER TABLE `checklists` DROP COLUMN `end_date`;