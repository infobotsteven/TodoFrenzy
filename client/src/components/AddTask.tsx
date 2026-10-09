import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { useBulkCreateTasks, useCreateTask } from '../queries';
import { t } from '../i18n';
import { parsePastedTasks, pluralTasks } from '../paste';
import { useUiStore } from '../store';

/** Pole szybkiego dodawania: wpisz nazwę i Enter, fokus zostaje w polu, więc można dodawać kolejne. */
export function AddTask({ checklistId }: { checklistId: string }) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateTask(checklistId);
  const bulk = useBulkCreateTasks(checklistId);
  const pushToast = useUiStore((s) => s.pushToast);

  // Wklejony tekst z wielu linii (np. z notatnika lub Markdowna) to lista zadań - dodajemy je wszystkie naraz
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const parsed = parsePastedTasks(e.clipboardData.getData('text'));
    if (!parsed) return; // zwykły tekst: domyślne wklejanie
    e.preventDefault();
    bulk.mutate(parsed.tasks, {
      onSuccess: (created) =>
        pushToast(
          t('addTask.pasted', { tasks: pluralTasks(created.length) }) + (parsed.truncated ? ` ${t('addTask.pastedLimit')}` : ''),
        ),
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { name: trimmed, description: '', priority: 'none', dueDate: null, userIds: [] },
      {
        onSuccess: () => {
          setName('');
          inputRef.current?.focus();
        },
      },
    );
  };

  return (
    <form className="add-task" onSubmit={submit}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onPaste={onPaste}
        placeholder={t('addTask.placeholder')}
        maxLength={200}
        enterKeyHint="done"
        aria-label={t('addTask.nameAria')}
      />
      <button type="submit" className="btn btn-primary" disabled={!name.trim() || create.isPending} aria-label={t('addTask.add')}>
        +
      </button>
    </form>
  );
}





