import { useState, type FormEvent, type ReactNode } from 'react';
import {
  checklistInputSchema,
  projectInputSchema,
  taskInputSchema,
  type ChecklistInput,
  type Color,
  type Priority,
  type ProjectInput,
  type TaskInput,
} from '@todo/shared';
import type { ZodType } from 'zod';
import { t } from '../i18n';
import { SYSTEM_PROJECT_DESCRIPTION } from '@todo/shared';
import { ColorPicker } from './ColorPicker';
import { PriorityPicker, TagPicker } from './TaskMeta';
import { UserPicker } from './UserParts';

type FormProps<T> = {
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: T) => void;
  onCancel: () => void;
  /** Gdy podane, formularz pokazuje przycisk usuwania (tryb edycji). */
  onDelete?: () => void;
  /** Gdy podane, formularz pokazuje przycisk kopiowania (tryb edycji). */
  onDuplicate?: () => void;
  /** Dodatkowe przyciski po lewej stronie (np. „Archiwizuj”). */
  extraActions?: ReactNode;
};

/** Wspólna obsługa: walidacja schematem z @todo/shared + komunikat o błędzie + przyciski. */
function useValidatedSubmit<T>(schema: ZodType<T>, onSubmit: (input: T) => void) {
  const [error, setError] = useState<string | null>(null);
  const submit = (raw: unknown, extraError?: string | null) => {
    const parsed = schema.safeParse(raw);
    if (extraError) return setError(extraError);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      return setError(field === 'name' ? t('form.nameError') : t('addTask.badFields'));
    }
    setError(null);
    onSubmit(parsed.data);
  };
  return { error, submit };
}

function FormShell({
  onSubmit,
  error,
  children,
  submitLabel,
  pending,
  onCancel,
  onDelete,
  onDuplicate,
  extraActions,
}: {
  onSubmit: (e: FormEvent) => void;
  error: string | null;
  children: ReactNode;
} & Omit<FormProps<unknown>, 'onSubmit'>) {
  return (
    <form onSubmit={onSubmit} className="form">
      {children}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {(onDelete || onDuplicate || extraActions) && (
          <div className="form-actions-left">
            {onDelete && (
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={pending}>
                {t('common.delete')}
              </button>
            )}
            {onDuplicate && (
              <button type="button" className="btn" onClick={onDuplicate} disabled={pending}>
                {t('form.duplicate')}
              </button>
            )}
            {extraActions}
          </div>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

export function ProjectForm({
  initial,
  onSubmit,
  locked = false,
  ...shell
}: FormProps<ProjectInput> & {
  initial?: { name: string; description: string; color: Color | null };
  /** Stały projekt „Inne”: nazwę i kolor można tylko oglądać, edytuje się sam opis. */
  locked?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState<Color | null>(initial?.color ?? null);
  const { error, submit } = useValidatedSubmit(projectInputSchema, onSubmit);

  return (
    <FormShell
      {...shell}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        submit({ name, description, color: locked ? null : color });
      }}
    >
      <Field label={t('form.projectName')}>
        <input value={locked ? t('system.project') : name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus={!locked} required readOnly={locked} />
      </Field>
      <Field label={t('form.description')}>
        <textarea
          value={locked && description === SYSTEM_PROJECT_DESCRIPTION ? t('system.description') : description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={5000}
        />
      </Field>
      {locked ? (
        <p className="muted small">{t('form.systemLocked')}</p>
      ) : (
        <div className="field">
          <span>{t('color.label')}</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      )}
    </FormShell>
  );
}

export function ChecklistForm({
  initial,
  onSubmit,
  ...shell
}: FormProps<ChecklistInput> & { initial?: Omit<ChecklistInput, 'color'> & { color: Color | null } }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState<Color | null>(initial?.color ?? null);
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const { error, submit } = useValidatedSubmit(checklistInputSchema, onSubmit);

  return (
    <FormShell
      {...shell}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        submit({ name, description, color, tagIds });
      }}
    >
      <Field label={t('form.listName')}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus required />
      </Field>
      <Field label={t('form.description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000} />
      </Field>
      <div className="field">
        <span>{t('color.label')}</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="field">
        <span>{t('form.listTags')}</span>
        <TagPicker value={tagIds} onChange={setTagIds} />
      </div>
    </FormShell>
  );
}

export function TaskForm({
  initial,
  onSubmit,
  ...shell
}: FormProps<TaskInput> & { initial?: TaskInput }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'none');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [userIds, setUserIds] = useState<string[]>(initial?.userIds ?? []);
  const { error, submit } = useValidatedSubmit(taskInputSchema, onSubmit);

  return (
    <FormShell
      {...shell}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        submit({ name, description, priority, dueDate: dueDate || null, userIds });
      }}
    >
      <Field label={t('form.taskName')}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus required />
      </Field>
      <Field label={t('form.description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000} />
      </Field>
      <div className="field">
        <span>{t('task.priority')}</span>
        <PriorityPicker value={priority} onChange={setPriority} />
      </div>
      <div className="field">
        <span>{t('form.due')}</span>
        <div className="date-row">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t('taskModal.dueAria')} />
          {dueDate && (
            <button type="button" className="btn" onClick={() => setDueDate('')}>
              {t('taskModal.removeDue')}
            </button>
          )}
        </div>
      </div>
      <div className="field">
        <span>{t('form.users')}</span>
        <UserPicker value={userIds} onChange={setUserIds} />
      </div>
    </FormShell>
  );
}



