import type { Checklist, ProjectSummary, Tag, Task, User } from './types.js';

/**
 * Zdarzenia wysyłane przez WebSocket po każdej zmianie danych.
 * `origin` to identyfikator klienta, który wykonał zmianę (nagłówek X-Client-Id) - pozwala mu
 * pominąć własne zdarzenia. Każde zdarzenie niesie id projektu, którego dotyczy, więc klient wie, co odświeżyć.
 */
export type RealtimeEvent = { origin?: string } & (
  | { type: 'project.created' | 'project.updated'; id: string; data: ProjectSummary }
  | { type: 'project.deleted'; id: string }
  | { type: 'project.reordered'; ids: string[] }
  | { type: 'checklist.created' | 'checklist.updated'; id: string; projectId: string; data: Checklist }
  | { type: 'checklist.deleted'; id: string; projectId: string }
  | { type: 'checklist.reordered'; projectId: string; ids: string[] }
  | { type: 'task.created' | 'task.updated' | 'task.completed'; id: string; projectId: string; data: Task }
  | { type: 'task.deleted'; id: string; projectId: string; checklistId: string }
  | { type: 'task.reordered'; projectId: string; ids: string[] }
  | { type: 'tag.updated'; id: string; data: Tag }
  | { type: 'tag.deleted'; id: string }
  | { type: 'user.updated'; id: string; data: User }
  | { type: 'user.deleted'; id: string }
);

export type RealtimeEventType = RealtimeEvent['type'];

