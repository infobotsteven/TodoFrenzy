import { eq } from 'drizzle-orm';
import { SYSTEM_COLOR, SYSTEM_LIST_NAME, SYSTEM_PROJECT_DESCRIPTION, SYSTEM_PROJECT_NAME } from '@todo/shared';
import { db } from './client.js';
import { newId } from './ids.js';
import { checklists, projects } from './schema.js';

/**
 * Stały projekt „Inne” z jedną listą „Zadania” - na zadania, które nie pasują do żadnego projektu.
 * Tworzony przy starcie serwera, jeśli jeszcze go nie ma (w istniejącej bazie po migracji, w nowej od razu).
 * Niezmienność (brak usuwania, brak kolejnych list) pilnują trasy API.
 */
export function ensureSystemProject() {
  db.transaction((tx) => {
    const existing = tx.select({ id: projects.id }).from(projects).where(eq(projects.isSystem, true)).get();
    const projectId = existing?.id ?? newId();
    if (!existing) {
      tx.insert(projects)
        .values({
          id: projectId,
          name: SYSTEM_PROJECT_NAME,
          description: SYSTEM_PROJECT_DESCRIPTION,
          color: SYSTEM_COLOR,
          isSystem: true,
          sortOrder: 0,
        })
        .run();
    }
    // lista „Zadania” musi istnieć (np. gdyby ktoś usunął ją ręcznie w bazie)
    if (!tx.select({ id: checklists.id }).from(checklists).where(eq(checklists.projectId, projectId)).get()) {
      tx.insert(checklists).values({ id: newId(), projectId, name: SYSTEM_LIST_NAME, sortOrder: 0 }).run();
    }
  });
}

export const isSystemProject = (projectId: string): boolean =>
  db.select({ isSystem: projects.isSystem }).from(projects).where(eq(projects.id, projectId)).get()?.isSystem === true;
