import { create } from 'zustand';
import type { Priority } from '@todo/shared';

// Zustand trzyma wyłącznie stan interfejsu. Dane z API są w TanStack Query.

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; action?: ToastAction };

const TOAST_MS = 6000;
const TOAST_WITH_ACTION_MS = 9000; // dłużej, żeby zdążyć kliknąć np. "Cofnij"

/** Układ list w projekcie na szerokich ekranach: siatka (zawijanie do kolejnych wierszy) albo slider (jeden rząd, przewijany poziomo). */
export type ListView = 'grid' | 'slider';
const LIST_VIEW_KEY = 'listView';
const CALENDAR_HIDE_COMPLETED_KEY = 'calendarHideCompleted';

function storedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function storedListView(): ListView {
  try {
    const value = localStorage.getItem(LIST_VIEW_KEY);
    return value === 'slider' ? 'slider' : 'grid';
  } catch {
    return 'grid';
  }
}

/** Ile kart na stronie w zakładkach „Zaległe”, „Bez terminu” i „Archiwum” (zadania) oraz „Projekty” i „Archiwum” (projekty); 0 = wszystkie (bez paginacji). */
export const PAGE_SIZES = [12, 24, 48, 96, 0] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 24;
const PAGE_SIZE_KEY = 'pageSize';
/** Karty projektów są większe niż karty zadań, więc domyślnie mniej na stronie; paginacja pojawia się dopiero po przekroczeniu najmniejszej strony (12). */
const DEFAULT_PROJECT_PAGE_SIZE: PageSize = 12;
const PROJECT_PAGE_SIZE_KEY = 'projectPageSize';

function storedPageSize(key: string, fallback: PageSize): PageSize {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback; // Number(null) === 0 oznaczałoby „Wszystkie”
    return PAGE_SIZES.find((size) => size === Number(stored)) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Filtr zadań w widoku projektu (tylko ukrywa zadania - nic nie zmienia w danych). */
export type TaskFilter = { tagId: string | null; priority: Priority | null; hideCompleted: boolean; userIds: string[] };
const NO_FILTER: TaskFilter = { tagId: null, priority: null, hideCompleted: false, userIds: [] };
export const isFilterActive = (f: TaskFilter) =>
  f.tagId !== null || f.priority !== null || f.hideCompleted || f.userIds.length > 0;

/** Specjalna wartość w filtrach użytkowników: zadania, do których nikt nie jest przypisany. */
export const NO_USER = '__none__';

/** Czy zadanie pasuje do filtra użytkowników (pusty filtr = każde; wybrani użytkownicy łączą się alternatywą). */
export const matchesUserFilter = (taskUsers: { id: string }[], filterIds: string[]) =>
  filterIds.length === 0 ||
  taskUsers.some((u) => filterIds.includes(u.id)) ||
  (filterIds.includes(NO_USER) && taskUsers.length === 0);

/** Filtry kalendarza i zaległych: puste tablice = wszystko. Lista wybrana w projekcie zawęża jego zadania do wybranych list. */
type CalendarFilter = {
  projectIds: string[];
  listIds: string[];
  userIds: string[];
  priorities: Priority[];
  /** Zarchiwizowane projekty, których zadania pokazujemy dodatkowo (domyślnie żadne - archiwalne są ukryte) */
  archivedIds: string[];
};
const NO_CALENDAR_FILTER: CalendarFilter = { projectIds: [], listIds: [], userIds: [], priorities: [], archivedIds: [] };

/** Kalendarz i widok „Zaległe” mają te same filtry, ale każdy z własnym stanem. */
export type FilterScope = 'calendar' | 'overdue' | 'undated' | 'archive';

/** Kolejność zaległych zadań: od najstarszego terminu albo od najnowszego. */
export type OverdueSort = 'oldest' | 'newest';

/** Kolejność zadań bez terminu: jak w projektach (projekt, lista, pozycja) albo wg daty dodania. */
export type UndatedSort = 'order' | 'newest' | 'oldest';

/** Kolejność archiwum: od ostatnio wykonanych albo od najdawniej wykonanych. */
export type ArchiveSort = 'newest' | 'oldest';

const toggle = <T,>(items: T[], item: T): T[] => (items.includes(item) ? items.filter((i) => i !== item) : [...items, item]);

/** Stan połączenia WebSocket (realtime). */
type Connection = 'connecting' | 'open' | 'closed';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'theme';

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // np. tryb prywatny - wtedy motyw działa, tylko nie jest zapamiętywany
  }
}

const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
const systemTheme = (): Theme => (systemQuery.matches ? 'dark' : 'light');
const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

type UiState = {
  /** Motyw: zapisany wybór, a bez niego motyw systemu. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  listView: ListView;
  /** Kalendarz: ukrywa wykonane zadania (to opcja widoku, więc „Wyczyść filtry” jej nie rusza). */
  calendarHideCompleted: boolean;
  setCalendarHideCompleted: (hide: boolean) => void;
  setListView: (view: ListView) => void;
  pageSize: PageSize;
  setPageSize: (size: PageSize) => void;
  projectPageSize: PageSize;
  setProjectPageSize: (size: PageSize) => void;
  connection: Connection;
  setConnection: (connection: Connection) => void;
  filters: Record<FilterScope, CalendarFilter>;
  toggleFilterProject: (scope: FilterScope, id: string, projectListIds: string[]) => void;
  toggleFilterList: (scope: FilterScope, id: string) => void;
  toggleFilterUser: (scope: FilterScope, id: string) => void;
  toggleFilterPriority: (scope: FilterScope, priority: Priority) => void;
  toggleFilterArchived: (scope: FilterScope, id: string, projectListIds: string[]) => void;
  resetFilter: (scope: FilterScope) => void;
  overdueSort: OverdueSort;
  setOverdueSort: (sort: OverdueSort) => void;
  undatedSort: UndatedSort;
  setUndatedSort: (sort: UndatedSort) => void;
  archiveSort: ArchiveSort;
  setArchiveSort: (sort: ArchiveSort) => void;
  taskFilter: TaskFilter;
  setTaskFilter: (patch: Partial<TaskFilter>) => void;
  resetTaskFilter: () => void;
  projectSearch: string;
  setProjectSearch: (value: string) => void;
  toasts: Toast[];
  pushToast: (message: string, action?: ToastAction) => void;
  dismissToast: (id: number) => void;
};

let nextToastId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  theme: storedTheme() ?? systemTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* brak zapisu nie przeszkadza */
    }
    set({ theme });
  },

  pageSize: storedPageSize(PAGE_SIZE_KEY, DEFAULT_PAGE_SIZE),
  setPageSize: (pageSize) => {
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    } catch {
      /* brak zapisu nie przeszkadza */
    }
    set({ pageSize });
  },

  projectPageSize: storedPageSize(PROJECT_PAGE_SIZE_KEY, DEFAULT_PROJECT_PAGE_SIZE),
  setProjectPageSize: (projectPageSize) => {
    try {
      localStorage.setItem(PROJECT_PAGE_SIZE_KEY, String(projectPageSize));
    } catch {
      /* brak zapisu nie przeszkadza */
    }
    set({ projectPageSize });
  },

  calendarHideCompleted: storedFlag(CALENDAR_HIDE_COMPLETED_KEY),
  setCalendarHideCompleted: (calendarHideCompleted) => {
    try {
      localStorage.setItem(CALENDAR_HIDE_COMPLETED_KEY, calendarHideCompleted ? '1' : '0');
    } catch {
      /* brak zapisu nie przeszkadza */
    }
    set({ calendarHideCompleted });
  },

  listView: storedListView(),
  setListView: (listView) => {
    try {
      localStorage.setItem(LIST_VIEW_KEY, listView);
    } catch {
      /* brak zapisu nie przeszkadza */
    }
    set({ listView });
  },

  connection: 'connecting',
  setConnection: (connection) => set({ connection }),

  filters: { calendar: NO_CALENDAR_FILTER, overdue: NO_CALENDAR_FILTER, undated: NO_CALENDAR_FILTER, archive: NO_CALENDAR_FILTER },
  toggleFilterProject: (scope, id, projectListIds) =>
    set((s) => {
      const f = s.filters[scope];
      const on = f.projectIds.includes(id);
      return {
        filters: {
          ...s.filters,
          [scope]: {
            ...f,
            projectIds: toggle(f.projectIds, id),
            // odznaczenie projektu zdejmuje też wybrane w nim listy
            listIds: on ? f.listIds.filter((l) => !projectListIds.includes(l)) : f.listIds,
          },
        },
      };
    }),
  toggleFilterList: (scope, id) =>
    set((s) => ({ filters: { ...s.filters, [scope]: { ...s.filters[scope], listIds: toggle(s.filters[scope].listIds, id) } } })),
  toggleFilterUser: (scope, id) =>
    set((s) => ({ filters: { ...s.filters, [scope]: { ...s.filters[scope], userIds: toggle(s.filters[scope].userIds, id) } } })),
  toggleFilterPriority: (scope, priority) =>
    set((s) => ({
      filters: { ...s.filters, [scope]: { ...s.filters[scope], priorities: toggle(s.filters[scope].priorities, priority) } },
    })),
  toggleFilterArchived: (scope, id, projectListIds) =>
    set((s) => {
      const f = s.filters[scope];
      const on = f.archivedIds.includes(id);
      // odznaczenie zarchiwizowanego projektu zdejmuje też wybrane w nim listy (jak przy projektach aktywnych)
      return {
        filters: { ...s.filters, [scope]: { ...f, archivedIds: toggle(f.archivedIds, id), listIds: on ? f.listIds.filter((l) => !projectListIds.includes(l)) : f.listIds } },
      };
    }),
  resetFilter: (scope) => set((s) => ({ filters: { ...s.filters, [scope]: NO_CALENDAR_FILTER } })),
  overdueSort: 'oldest',
  setOverdueSort: (overdueSort) => set({ overdueSort }),
  undatedSort: 'order',
  setUndatedSort: (undatedSort) => set({ undatedSort }),
  archiveSort: 'newest',
  setArchiveSort: (archiveSort) => set({ archiveSort }),

  taskFilter: NO_FILTER,
  setTaskFilter: (patch) => set((s) => ({ taskFilter: { ...s.taskFilter, ...patch } })),
  resetTaskFilter: () => set({ taskFilter: NO_FILTER }),

  projectSearch: '',
  setProjectSearch: (projectSearch) => set({ projectSearch }),

  toasts: [],
  pushToast: (message, action) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, action }] }));
    setTimeout(() => get().dismissToast(id), action ? TOAST_WITH_ACTION_MS : TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Początkowy motyw (index.html ustawia go jeszcze przed renderem, żeby nie było mignięcia)
applyTheme(useUiStore.getState().theme);

// Dopóki użytkownik nie wybrał motywu ręcznie, podążamy za ustawieniem systemu
systemQuery.addEventListener('change', () => {
  if (storedTheme() === null) {
    applyTheme(systemTheme());
    useUiStore.setState({ theme: systemTheme() });
  }
});


