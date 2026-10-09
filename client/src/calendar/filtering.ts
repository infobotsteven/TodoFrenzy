import type { CalendarSources, CalendarTask } from '@todo/shared';
import { useMemo } from 'react';
import { matchesUserFilter, useUiStore, type FilterScope } from '../store';

/**
 * Które zadania pasują do filtrów danego widoku: projekty, listy, użytkownicy i priorytet (lista wybrana w projekcie zawęża
 * jego zadania do wybranych list).
 *
 * Zadania **zarchiwizowanych projektów** (w kalendarzu) są domyślnie ukryte; pokazuje je dopiero włączenie projektu w sekcji
 * „Projekty archiwalne”. Wtedy podlegają filtrom osób i priorytetu (nie filtrom projektów/list aktywnych projektów, bo to
 * osobna sekcja). W widoku „Archiwum” projekty aktywne i archiwalne to dwie sekcje jednego filtra (bez wyboru widać wszystko, po wyborze tylko wybrane projekty).
 */
export function useFilteredTasks(scope: FilterScope, tasks: CalendarTask[], sources: CalendarSources | undefined): CalendarTask[] {
  const filter = useUiStore((s) => s.filters[scope]);
  return useMemo(() => {
    const matchesPeople = (t: CalendarTask) =>
      matchesUserFilter(t.users, filter.userIds) && (!filter.priorities.length || filter.priorities.includes(t.priority));
    // projekty, w których wybrano konkretne listy (w „Archiwum” także zarchiwizowane projekty mają wybór list)
    const listSources = scope === 'archive' ? [...(sources?.projects ?? []), ...(sources?.archivedProjects ?? [])] : (sources?.projects ?? []);
    const restricted = new Set(listSources.filter((p) => p.lists.some((l) => filter.listIds.includes(l.id))).map((p) => p.id));
    const matchesLists = (t: CalendarTask) => !restricted.has(t.projectId) || filter.listIds.includes(t.checklistId);
    const matchesActive = (t: CalendarTask) =>
      (!filter.projectIds.length || filter.projectIds.includes(t.projectId)) && matchesLists(t) && matchesPeople(t);

    // „Archiwum”: projekty aktywne i archiwalne to dwie sekcje jednego filtra - bez wyboru widać wszystko, a po wybraniu
    // tylko zadania wybranych projektów (z obu sekcji razem)
    if (scope === 'archive') {
      const anyProject = filter.projectIds.length > 0 || filter.archivedIds.length > 0;
      return tasks.filter((t) => {
        const chosen = t.projectArchivedAt ? filter.archivedIds : filter.projectIds;
        return (!anyProject || chosen.includes(t.projectId)) && matchesLists(t) && matchesPeople(t);
      });
    }

    return tasks.filter((t) => {
      if (t.projectArchivedAt) return filter.archivedIds.includes(t.projectId) && matchesPeople(t);
      return matchesActive(t);
    });
  }, [scope, tasks, sources, filter]);
}
