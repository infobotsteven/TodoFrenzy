import type { Tag } from '@todo/shared';
import { useState } from 'react';
import { t } from '../i18n';
import { useDeleteTag, useRenameTag, useTags } from '../queries';
import { Modal } from './Modal';
import { askConfirm } from '../confirm';

function TagRow({ tag }: { tag: Tag }) {
  const [name, setName] = useState(tag.name);
  const rename = useRenameTag();
  const remove = useDeleteTag();

  const save = () => {
    const next = name.trim();
    if (!next) return setName(tag.name);
    if (next === tag.name) return;
    // przy błędzie (np. zajęta nazwa) wracamy do poprzedniej, a komunikat pokazuje globalna obsługa błędów
    rename.mutate({ id: tag.id, name: next }, { onError: () => setName(tag.name) });
  };

  return (
    <li className="tag-row">
      <input
        value={name}
        maxLength={50}
        aria-label={t('tags.nameAria', { name: tag.name })}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), e.preventDefault())}
      />
      <button
        type="button"
        className="btn btn-danger"
        disabled={remove.isPending}
        onClick={async () => {
          const ok = await askConfirm({
            title: t('tags.deleteTitle'),
            message: t('tags.deleteMessage', { name: tag.name }),
            confirmLabel: t('tags.deleteConfirm'),
          });
          if (ok) remove.mutate(tag.id);
        }}
      >
        {t('common.delete')}
      </button>
    </li>
  );
}

/** Okno zarządzania tagami: zmiana nazwy (Enter lub wyjście z pola) i usuwanie. Nowe tagi dodaje się przy listach. */
export function TagManager({ onClose }: { onClose: () => void }) {
  const tags = useTags();
  return (
    <Modal title={t('tags.title')} onClose={onClose}>
      {tags.isPending && <p className="muted">{t('app.loading')}</p>}
      {tags.data && tags.data.length === 0 && (
        <p className="muted">{t('tags.empty')}</p>
      )}
      <ul className="tag-list">
        {tags.data?.map((tag) => <TagRow key={tag.id} tag={tag} />)}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </Modal>
  );
}

