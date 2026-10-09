import { PRIORITIES, type Priority, type Tag, type User } from '@todo/shared';
import { t } from '../i18n';
import { priorityLabel } from '../labels';
import { isFilterActive, NO_USER, useUiStore } from '../store';
import { AvatarImage } from './UserAvatar';

/**
 * Filtry w projekcie: priorytet i ukrywanie wykonanych działają na zadaniach, tag na listach (pokazujemy tylko listy
 * z wybranym tagiem), a użytkownicy zawężają zadania do przypisanych do wybranych osób (albo do nieprzypisanych).
 * Filtry tylko ukrywają - nic nie zmieniają w danych. Układ jak w filtrach kalendarza: wiersze z etykietami.
 */
export function TaskFilters({ tags, users }: { tags: Tag[]; users: User[] }) {
  const filter = useUiStore((s) => s.taskFilter);
  const setFilter = useUiStore((s) => s.setTaskFilter);
  const reset = useUiStore((s) => s.resetTaskFilter);
  const noUserOn = filter.userIds.includes(NO_USER);

  return (
    <div className="filters filter-panel" role="group" aria-label={t('taskFilters.label')}>
      <div className="filter-controls">
        <select
          value={filter.priority ?? ''}
          onChange={(e) => setFilter({ priority: (e.target.value || null) as Priority | null })}
          aria-label={t('taskFilters.priorityAria')}
        >
          <option value="">{t('taskFilters.anyPriority')}</option>
          {PRIORITIES.filter((p) => p !== 'none').map((p) => (
            <option key={p} value={p}>
              {t('taskFilters.priorityOption', { name: priorityLabel(p) })}
            </option>
          ))}
        </select>

        <label className="check-inline">
          <input
            type="checkbox"
            checked={filter.hideCompleted}
            onChange={(e) => setFilter({ hideCompleted: e.target.checked })}
          />
          {t('taskFilters.hideCompleted')}
        </label>

        {isFilterActive(filter) && (
          <button type="button" className="btn" onClick={reset}>
            {t('filters.reset')}
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">{t('taskFilters.listTags')}</span>
          <div className="chips" aria-label={t('taskFilters.tagAria')}>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={filter.tagId === tag.id ? 'chip chip-on' : 'chip'}
                aria-pressed={filter.tagId === tag.id}
                onClick={() => setFilter({ tagId: filter.tagId === tag.id ? null : tag.id })}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {users.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">{t('filters.users')}</span>
          <div className="chips" aria-label={t('taskFilters.userAria')}>
            {users.map((u) => {
              const on = filter.userIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={on ? 'chip chip-on user-chip' : 'chip user-chip'}
                  aria-pressed={on}
                  onClick={() => setFilter({ userIds: on ? filter.userIds.filter((id) => id !== u.id) : [...filter.userIds, u.id] })}
                >
                  <AvatarImage avatar={u.avatar} size={20} />
                  {u.nick}
                </button>
              );
            })}
            <button
              type="button"
              className={noUserOn ? 'chip chip-on' : 'chip'}
              aria-pressed={noUserOn}
              onClick={() =>
                setFilter({ userIds: noUserOn ? filter.userIds.filter((id) => id !== NO_USER) : [...filter.userIds, NO_USER] })
              }
            >
              {t('filters.noAssignee')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
