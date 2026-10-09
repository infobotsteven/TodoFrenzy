import { PRIORITIES, type Priority, type Tag } from '@todo/shared';
import { useState } from 'react';
import { formatDueDate } from '../format';
import { t } from '../i18n';
import { priorityLabel, todayIso } from '../labels';
import { useCreateTag, useTags } from '../queries';

/** Znaczek priorytetu przy zadaniu (dla "Brak" nic nie pokazujemy). */
export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === 'none') return null;
  return (
    <span className="badge" data-priority={priority} title={t('task.priorityTitle', { name: priorityLabel(priority) })}>
      <span className="badge-dot" />
      {priorityLabel(priority)}
    </span>
  );
}

/** Termin zadania. Po terminie (data minęła, a zadanie nie jest wykonane) jest czerwony, dzisiejszy - żółty. */
export function DueDate({ date, completed }: { date: string; completed: boolean }) {
  const today = todayIso();
  const state = completed ? 'done' : date < today ? 'overdue' : date === today ? 'today' : 'later';
  const title =
    state === 'overdue' ? t('task.overdue') : state === 'today' ? t('task.dueToday') : t('task.dueOn', { date });
  return (
    <span className={`due due-${state}`} title={title}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      {formatDueDate(date)}
      {state === 'overdue' && ` · ${t('task.overdueInline')}`}
    </span>
  );
}

export function TagChip({ tag }: { tag: Tag }) {
  return <span className="tag">{tag.name}</span>;
}

/** Wybór priorytetu: cztery przyciski (radio), działa też z klawiatury. */
export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <fieldset className="seg" aria-label={t('task.priority')}>
      {PRIORITIES.map((p) => (
        <label key={p} className="seg-item" data-priority={p}>
          <input type="radio" name="priority" checked={value === p} onChange={() => onChange(p)} />
          <span>{priorityLabel(p)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Wybór tagów listy: wybrane tagi (klik = usuń), pozostałe istniejące tagi (klik = dodaj) oraz pole
 * do wpisania nowego tagu (Enter). Wpisanie nazwy istniejącego tagu dodaje go zamiast tworzyć duplikat.
 */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const tags = useTags();
  const create = useCreateTag();
  const [text, setText] = useState('');
  const all = tags.data ?? [];
  const selected = value.map((id) => all.find((tag) => tag.id === id)).filter((tag): tag is Tag => !!tag);
  const available = all.filter((tag) => !value.includes(tag.id));

  const addTyped = async () => {
    const name = text.trim();
    if (!name) return;
    const existing = all.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    try {
      const tag = existing ?? (await create.mutateAsync(name));
      if (!value.includes(tag.id)) onChange([...value, tag.id]);
      setText('');
    } catch {
      /* komunikat o błędzie pokazuje globalna obsługa mutacji */
    }
  };

  return (
    <div className="tag-picker">
      {selected.length > 0 && (
        <div className="chips" aria-label={t('tags.selected')}>
          {selected.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="chip chip-on"
              title={t('tags.removeFromTask')}
              onClick={() => onChange(value.filter((id) => id !== tag.id))}
            >
              {tag.name} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // Enter dodaje tag, a nie wysyła formularza
            addTyped();
          }
        }}
        placeholder={t('tags.addPlaceholder')}
        maxLength={50}
        aria-label={t('tags.new')}
      />
      {available.length > 0 && (
        <div className="chips" aria-label={t('tags.available')}>
          {available.map((tag) => (
            <button key={tag.id} type="button" className="chip" onClick={() => onChange([...value, tag.id])}>
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


