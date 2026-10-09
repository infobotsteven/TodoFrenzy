import { taskInputSchema, type Priority } from '@todo/shared';
import { useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { PriorityPicker } from '../components/TaskMeta';
import { UserPicker } from '../components/UserParts';
import { formatDueDate } from '../format';
import { t } from '../i18n';
import { listName, projectName } from '../labels';
import { useCreateTask, useProject, useProjects } from '../queries';
import { useUiStore } from '../store';

/**
 * Dodawanie zadania z kalendarza na wybrany dzień. Bez wybranego projektu zadanie trafia do stałego projektu „Inne”
 * (do jego jedynej listy). Po wybraniu projektu można wskazać listę (domyślnie pierwsza).
 */
export function CalendarAddTaskModal({ date, onClose }: { date: string; onClose: () => void }) {
  const projects = useProjects();
  const pushToast = useUiStore((s) => s.pushToast);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [dueDate, setDueDate] = useState(date);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [chosenProject, setChosenProject] = useState<string | null>(null);
  const [chosenList, setChosenList] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // brak wyboru = „Inne”
  const fallback = projects.data?.find((p) => p.isSystem);
  const projectId = chosenProject ?? fallback?.id ?? null;
  const project = useProject(projectId ?? '', !!projectId);
  const lists = project.data?.checklists ?? [];
  const list = lists.find((l) => l.id === chosenList) ?? lists[0] ?? null;
  const create = useCreateTask(list?.id ?? '');

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!list || !project.data) return setError(t('addTask.noList'));
    const parsed = taskInputSchema.safeParse({ name, description, priority, dueDate: dueDate || null, userIds });
    if (!parsed.success) {
      return setError(parsed.error.issues[0]?.path[0] === 'name' ? t('addTask.badName') : t('addTask.badFields'));
    }
    if (!parsed.data.dueDate) return setError(t('addTask.needDate'));
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        pushToast(t('addTask.created', { where: `${projectName(project.data)} › ${listName(list.name, project.data.isSystem)}` }));
        onClose();
      },
    });
  };

  return (
    <Modal title={t('addTask.title')} onClose={onClose}>
      <form onSubmit={save} className="form">
        <label className="field">
          <span>{t('addTask.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus required />
        </label>
        <label className="field">
          <span>{t('form.description')}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>{t('addTask.project')}</span>
            <select
              value={projectId ?? ''}
              onChange={(e) => {
                setChosenProject(e.target.value);
                setChosenList(null);
              }}
              disabled={!projects.data}
            >
              {(projects.data ?? []).filter((p) => !p.archivedAt).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isSystem ? t('addTask.defaultSuffix', { name: projectName(p) }) : p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('addTask.list')}</span>
            <select
              value={list?.id ?? ''}
              onChange={(e) => setChosenList(e.target.value)}
              disabled={project.isPending || lists.length === 0}
            >
              {lists.length === 0 && <option value="">{project.isPending ? t('app.loading') : t('addTask.noLists')}</option>}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {listName(l.name, !!project.data?.isSystem)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span>{t('addTask.date')}</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required aria-label={t('addTask.date')} />
          {dueDate && <span className="small">{formatDueDate(dueDate)}</span>}
        </div>
        <div className="field">
          <span>{t('task.priority')}</span>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>
        <div className="field">
          <span>{t('form.users')}</span>
          <UserPicker value={userIds} onChange={setUserIds} />
        </div>

        {(error || create.isError) && (
          <p className="form-error" role="alert">
            {error ?? t('addTask.failed', { error: create.error?.message ?? '' })}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending || !projects.data}>
            {t('addTask.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
