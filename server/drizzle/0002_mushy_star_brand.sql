CREATE TABLE `checklist_tags` (
	`checklist_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`checklist_id`, `tag_id`),
	FOREIGN KEY (`checklist_id`) REFERENCES `checklists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_tags_tag_idx` ON `checklist_tags` (`tag_id`);
--> statement-breakpoint
-- Przeniesienie istniejących tagów zadań na ich listy: lista dostaje sumę (bez powtórzeń) tagów swoich zadań.
INSERT OR IGNORE INTO `checklist_tags` (`checklist_id`, `tag_id`)
SELECT DISTINCT `t`.`checklist_id`, `tt`.`tag_id`
FROM `task_tags` `tt`
JOIN `tasks` `t` ON `t`.`id` = `tt`.`task_id`;
