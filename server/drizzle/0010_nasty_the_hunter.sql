ALTER TABLE `tasks` ADD `completed_at` integer;--> statement-breakpoint
CREATE INDEX `tasks_completed_at_idx` ON `tasks` (`completed_at`);--> statement-breakpoint
-- istniejące wykonane zadania: najlepsze dostępne przybliżenie momentu wykonania to ostatnia zmiana zadania
UPDATE `tasks` SET `completed_at` = `updated_at` WHERE `completed` = 1 AND `completed_at` IS NULL;
