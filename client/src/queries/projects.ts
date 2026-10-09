import { useMutation, useQuery } from '@tanstack/react-query';
import type { ProjectDetail, ProjectInput, ProjectPatch, ProjectSummary } from '@todo/shared';
import { api } from '../api';
import { projectKey, projectsKey, useInvalidate } from './shared';

export const useProjects = () =>
  useQuery({ queryKey: projectsKey, queryFn: () => api.get<ProjectSummary[]>('/projects') });

export const useProject = (id: string, enabled = true) =>
  useQuery({
    queryKey: projectKey(id),
    enabled,
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    // 404 nie ma sensu ponawiać
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 1,
  });

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProjectInput) => api.post<ProjectSummary>('/projects', input),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: ProjectPatch & { id: string }) =>
      api.patch<ProjectSummary>(`/projects/${id}`, patch),
    onSuccess: invalidate,
  });
}

export function useDuplicateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<ProjectSummary>(`/projects/${id}/duplicate`, undefined),
    onSuccess: invalidate,
  });
}

/** Archiwizacja projektu: jego zadania trafiają do archiwum zadań i znikają z kalendarza. */
export function useArchiveProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<ProjectSummary>(`/projects/${id}/archive`, undefined),
    onSuccess: invalidate,
  });
}

/** Przywrócenie projektu z archiwum (cały projekt razem z zadaniami). */
export function useRestoreProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<ProjectSummary>(`/projects/${id}/restore`, undefined),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: invalidate,
  });
}
