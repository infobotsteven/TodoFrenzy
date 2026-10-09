import { relations, sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { AVATARS, COLORS, PRIORITIES, SYSTEM_COLOR } from '@todo/shared';

/** Znaczniki czasu jako unix ms. Wartość ustawia baza, a `updated_at` odświeża kod przy każdym PATCH. */
const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// Klucze główne to losowe id tekstowe (nanoid) - id projektu jest jednocześnie "sekretem" w linku.

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** Klucz z palety COLORS albo NULL (domyślny wygląd) */
  color: text('color', { enum: [...COLORS, SYSTEM_COLOR] }),
  /** Stały projekt „Inne” (jeden, nieusuwalny, z jedną listą) */
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  /** Kiedy projekt trafił do archiwum (NULL = aktywny). Zadania zarchiwizowanego projektu są w archiwum zadań i poza kalendarzem. */
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const checklists = sqliteTable(
  'checklists',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    color: text('color', { enum: [...COLORS, SYSTEM_COLOR] }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('checklists_project_sort_idx').on(t.projectId, t.sortOrder)],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    checklistId: text('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    /** Kiedy zadanie zostało oznaczone jako wykonane (NULL = niewykonane); źródło statystyk. Odznaczenie czyści wartość. */
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    /** Zbiór wartości w @todo/shared; w bazie zwykły tekst, żeby łatwo go rozszerzyć bez migracji */
    priority: text('priority', { enum: PRIORITIES }).notNull().default('none'),
    /** Termin wykonania w formacie YYYY-MM-DD albo NULL */
    dueDate: text('due_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('tasks_checklist_sort_idx').on(t.checklistId, t.sortOrder),
    // kalendarz i zaległe filtrują po terminie
    index('tasks_due_date_idx').on(t.dueDate),
    // statystyki liczą wykonane zadania w przedziale czasu
    index('tasks_completed_at_idx').on(t.completedAt),
  ],
);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
});

/** Użytkownicy do przypisywania do zadań (jak tagi: bez logowania, sam nick i awatar). */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  nick: text('nick').notNull(),
  /** Klucz awatara z @todo/shared (pikselowy zwierzak) */
  avatar: text('avatar', { enum: AVATARS }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const taskUsers = sqliteTable(
  'task_users',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] }), index('task_users_user_idx').on(t.userId)],
);

/** Tagi należą do list (checklist), nie do zadań. */
export const checklistTags = sqliteTable(
  'checklist_tags',
  {
    checklistId: text('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.checklistId, t.tagId] }), index('checklist_tags_tag_idx').on(t.tagId)],
);

/**
 * Sesje logowania. W bazie jest tylko skrót (sha256) tokenu z ciasteczka — wyciek pliku bazy nie pozwala przejąć żadnej sesji.
 * `credential_fingerprint` wiąże sesję z poświadczeniami z .env: ich zmiana unieważnia wszystkie sesje.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    credentialFingerprint: text('credential_fingerprint').notNull(),
  },
  (t) => [index('sessions_expires_idx').on(t.expiresAt)],
);

// --- Relacje (dla zapytań relacyjnych Drizzle) ---

export const projectsRelations = relations(projects, ({ many }) => ({
  checklists: many(checklists),
}));

export const checklistsRelations = relations(checklists, ({ one, many }) => ({
  project: one(projects, { fields: [checklists.projectId], references: [projects.id] }),
  tasks: many(tasks),
  checklistTags: many(checklistTags),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  checklist: one(checklists, { fields: [tasks.checklistId], references: [checklists.id] }),
  taskUsers: many(taskUsers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  taskUsers: many(taskUsers),
}));

export const taskUsersRelations = relations(taskUsers, ({ one }) => ({
  task: one(tasks, { fields: [taskUsers.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskUsers.userId], references: [users.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  checklistTags: many(checklistTags),
}));

export const checklistTagsRelations = relations(checklistTags, ({ one }) => ({
  checklist: one(checklists, { fields: [checklistTags.checklistId], references: [checklists.id] }),
  tag: one(tags, { fields: [checklistTags.tagId], references: [tags.id] }),
}));



