// Kształt danych zwracanych przez API (daty jako ISO string, bo tak trafiają do JSON-a).

/** Priorytety zadań. Dodanie nowego = jedna zmiana tutaj (kolumna w bazie to zwykły tekst). */
export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Kolory projektów i list. W bazie jest tylko nazwa, a odcień (jasny/ciemny motyw) ustala frontend. */
export const COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'gray'] as const;
/** Kolor zarezerwowany dla stałego projektu „Inne” - nie ma go w palecie wyboru, więc żaden inny projekt go nie dostanie. */
export const SYSTEM_COLOR = 'brown' as const;
export type Color = (typeof COLORS)[number] | typeof SYSTEM_COLOR;

/** Nazwy stałego projektu i jego jedynej listy. */
export const SYSTEM_PROJECT_NAME = 'Inne';
export const SYSTEM_LIST_NAME = 'Zadania';
/** Domyślny opis stałego projektu (w bazie po polsku; klient pokazuje go w języku interfejsu, dopóki użytkownik go nie zmieni). */
export const SYSTEM_PROJECT_DESCRIPTION = 'Zadania luzem, które nie pasują do żadnego projektu. Ten projekt jest stały i nie można go usunąć.';

/** Awatary użytkowników - klucze pikselowych zwierzaków (rysunki są w kliencie). */
export const AVATARS = ['cat', 'dog', 'fox', 'bear', 'rabbit', 'panda', 'frog', 'pig', 'owl', 'penguin', 'lion', 'koala'] as const;
export type Avatar = (typeof AVATARS)[number];

/** Użytkownik do przypisywania do zadań (na razie bez logowania - sam nick i awatar). */
export type User = {
  id: string;
  nick: string;
  avatar: Avatar;
};

export type Tag = {
  id: string;
  name: string;
};

export type Task = {
  id: string;
  checklistId: string;
  name: string;
  description: string;
  completed: boolean;
  priority: Priority;
  /** Termin wykonania, YYYY-MM-DD (jedna data) */
  dueDate: string | null;
  /** Użytkownicy przypisani do zadania */
  users: User[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Checklist = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  color: Color | null;
  /** Tagi przypisane do listy (tagi należą do list, nie do zadań) */
  tags: Tag[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
};

/** Projekt z licznikami zadań ze wszystkich jego list (widok główny). */
export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  color: Color | null;
  /** Stały projekt „Inne”: nie można go usunąć, ma jedną listę i zawsze jest pierwszy */
  isSystem: boolean;
  /** Moment zarchiwizowania (ISO) albo null dla aktywnego projektu */
  archivedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  completedCount: number;
};

/** Projekt wraz z listami i zadaniami (widok projektu). */
export type ProjectDetail = ProjectSummary & {
  checklists: Checklist[];
};

// --- Kalendarz (widok główny) ---

/** Zadanie z terminem wraz z informacją, do jakiego projektu i listy należy. */
export type CalendarTask = Task & {
  projectId: string;
  projectName: string;
  projectColor: Color | null;
  /** Gdy projekt jest zarchiwizowany: kiedy; wtedy zadanie jest w archiwum i domyślnie poza kalendarzem */
  projectArchivedAt: string | null;
  checklistName: string;
  checklistColor: Color | null;
};

/** Odpowiedź kalendarza dla zakresu dat (włącznie z obu końcami). */
export type CalendarRange = {
  from: string;
  to: string;
  tasks: CalendarTask[];
};

/** Niewykonane zadania po terminie (widok „Zaległe”) wraz z projektami i listami, w których są - opcje filtrów. */
export type OverdueTasks = {
  /** Zadania z terminem wcześniejszym niż ta data (YYYY-MM-DD) */
  before: string;
  tasks: CalendarTask[];
  sources: CalendarSources;
};

/** Niewykonane zadania bez terminu (widok „Bez terminu”) wraz z projektami i listami, w których są - opcje filtrów. */
export type UndatedTasks = {
  tasks: CalendarTask[];
  sources: CalendarSources;
};

/** Wykonane zadania (widok „Archiwum”; od ostatnio zmienionych) wraz z projektami i listami, w których są - opcje filtrów. */
export type ArchivedTasks = {
  tasks: CalendarTask[];
  sources: CalendarSources;
};

/** Zadanie wykonane w zakresie czasu (statystyki): chwila wykonania, nazwa i kolor projektu (kropka przy nazwie). */
export type CompletedTask = {
  id: string;
  name: string;
  completedAt: string;
  projectColor: Color | null;
};

/** Zadania wykonane w zakresie czasu, od najwcześniejszego; dni liczy klient wg swojej strefy czasowej. */
export type CompletionStats = {
  tasks: CompletedTask[];
};

/** Projekty i listy, które mają zadania z terminem - opcje filtrów kalendarza. */
export type CalendarSourceProject = {
  id: string;
  name: string;
  color: Color | null;
  lists: { id: string; name: string; color: Color | null }[];
};

export type CalendarSources = {
  projects: CalendarSourceProject[];
  /** Zarchiwizowane projekty z zadaniami w widoku - osobna sekcja filtrów („Projekty archiwalne”), domyślnie ukryte */
  archivedProjects: CalendarSourceProject[];
};


