import { z } from 'zod';
import { AVATARS, COLORS, PRIORITIES } from './types.js';

export * from './types.js';
export * from './events.js';

export const prioritySchema = z.enum(PRIORITIES);
const colorSchema = z.enum(COLORS).nullable();

const idSchema = z.string().min(1).max(64);
const nameSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().max(5000);
/** Data bez godziny, np. 2026-06-15 */
const dateSchema = z.iso.date();

// Schematy "Input" (tworzenie) mają wartości domyślne. Schematy "Patch" (edycja) są budowane
// z pól BEZ domyślnych, żeby brakujące pole nie nadpisało istniejącej wartości domyślną.

// --- Projekty ---

const projectFields = { name: nameSchema, description: descriptionSchema, color: colorSchema };
export const projectInputSchema = z.object({
  ...projectFields,
  description: descriptionSchema.default(''),
  color: colorSchema.default(null),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;
export const projectPatchSchema = z.object(projectFields).partial();
export type ProjectPatch = z.infer<typeof projectPatchSchema>;

// --- Listy / checklisty ---

const checklistFields = {
  name: nameSchema,
  description: descriptionSchema,
  color: colorSchema,
  /** Id tagów listy */
  tagIds: z.array(idSchema),
};
export const checklistInputSchema = z.object({
  ...checklistFields,
  description: descriptionSchema.default(''),
  color: colorSchema.default(null),
  tagIds: z.array(idSchema).default([]),
});
export type ChecklistInput = z.infer<typeof checklistInputSchema>;
export const checklistPatchSchema = z.object(checklistFields).partial();
export type ChecklistPatch = z.infer<typeof checklistPatchSchema>;

// --- Zadania ---

const taskFields = {
  name: nameSchema,
  description: descriptionSchema,
  priority: prioritySchema,
  /** Termin wykonania - jedna data lub brak */
  dueDate: dateSchema.nullable(),
  /** Id użytkowników przypisanych do zadania */
  userIds: z.array(idSchema),
};
export const taskInputSchema = z.object({
  ...taskFields,
  description: descriptionSchema.default(''),
  priority: prioritySchema.default('none'),
  dueDate: dateSchema.nullable().default(null),
  userIds: z.array(idSchema).default([]),
});
export type TaskInput = z.infer<typeof taskInputSchema>;
export const taskPatchSchema = z.object(taskFields).partial();
export type TaskPatch = z.infer<typeof taskPatchSchema>;

/**
 * Tworzenie zadania przez API: jak TaskInput, plus opcjonalnie stan wykonania i miejsce na liście
 * (indeks od 0). Służy m.in. do cofnięcia usunięcia - zadanie wraca tam, gdzie było.
 */
export const taskCreateSchema = taskInputSchema.extend({
  completed: z.boolean().default(false),
  position: z.number().int().min(0).optional(),
});
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const taskCompletedSchema = z.object({ completed: z.boolean() });

/** Hurtowe dodanie zadań (np. po wklejeniu listy z wielu linii). Kolejność tablicy = kolejność na liście. */
export const MAX_BULK_TASKS = 200;
export const taskBulkSchema = z.object({
  items: z
    .array(z.object({ name: nameSchema, completed: z.boolean().default(false) }))
    .min(1)
    .max(MAX_BULK_TASKS),
});
export type TaskBulkInput = z.infer<typeof taskBulkSchema>;

// --- Użytkownicy ---

export const avatarSchema = z.enum(AVATARS);
export const userInputSchema = z.object({
  nick: z.string().trim().min(1).max(24),
  avatar: avatarSchema,
});
export type UserInput = z.infer<typeof userInputSchema>;
export const userPatchSchema = userInputSchema.partial();
export type UserPatch = z.infer<typeof userPatchSchema>;

// --- Tagi ---

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
});
export type TagInput = z.infer<typeof tagInputSchema>;

// --- Kalendarz ---

export const MAX_CALENDAR_DAYS = 93;
export const calendarQuerySchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((q) => q.from <= q.to, { message: 'from nie może być późniejsze niż to' })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 < MAX_CALENDAR_DAYS, {
    message: `zakres może mieć najwyżej ${MAX_CALENDAR_DAYS} dni`,
  });

/** Zaległe = niewykonane z terminem wcześniejszym niż `before` (dzisiejsza data klienta - serwer nie zna jego strefy czasowej). */
export const overdueQuerySchema = z.object({ before: dateSchema });

// --- Statystyki ---

/** Najdłuższy zakres statystyk (dni): wystarcza na rok i trochę więcej. */
export const MAX_STATS_DAYS = 400;
/** Zakres czasu [from, to) jako chwile (ISO 8601 w UTC) - granice dni wyznacza przeglądarka w swojej strefie czasowej. */
export const statsQuerySchema = z
  .object({ from: z.iso.datetime(), to: z.iso.datetime() })
  .refine((q) => q.from < q.to, { message: 'from must be earlier than to' })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= MAX_STATS_DAYS, {
    message: `range may be at most ${MAX_STATS_DAYS} days`,
  });

// --- Logowanie ---

export const loginInputSchema = z.object({
  user: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

// --- Zmiana kolejności (drag & drop) ---

/** Lista id w nowej kolejności, w obrębie jednego rodzica. */
export const reorderSchema = z.object({
  ids: z.array(idSchema).min(1),
});
export type ReorderInput = z.infer<typeof reorderSchema>;




