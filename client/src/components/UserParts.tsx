import { AVATARS, type Avatar, type User } from '@todo/shared';
import { useState } from 'react';
import { t } from '../i18n';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../queries';
import { Modal } from './Modal';
import { AvatarImage } from './UserAvatar';
import { avatarLabel } from './avatars';
import { askConfirm } from '../confirm';

/** Wybór awatara: siatka pikselowych zwierzaków (radio, działa też z klawiatury). */
function AvatarPicker({ value, onChange, name }: { value: Avatar; onChange: (a: Avatar) => void; name: string }) {
  return (
    <fieldset className="avatar-grid" aria-label={t('users.avatar')}>
      {AVATARS.map((a) => (
        <label key={a} className="avatar-option" title={avatarLabel(a)}>
          <input type="radio" name={name} checked={value === a} onChange={() => onChange(a)} aria-label={avatarLabel(a)} />
          <AvatarImage avatar={a} size={40} />
          <span>{avatarLabel(a)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Nick + wybór awatara. Celowo bez <form>, bo bywa osadzony w innym formularzu (okno zadania). */
function NewUserForm({ onCreated, onCancel }: { onCreated?: (user: User) => void; onCancel?: () => void }) {
  const users = useUsers();
  const create = useCreateUser();
  const [nick, setNick] = useState('');
  // domyślnie kolejny awatar z listy, żeby nowi użytkownicy nie wyglądali tak samo
  const [avatar, setAvatar] = useState<Avatar>(AVATARS[(users.data?.length ?? 0) % AVATARS.length]!);

  const submit = () => {
    const trimmed = nick.trim();
    if (!trimmed) return;
    create.mutate(
      { nick: trimmed, avatar },
      {
        onSuccess: (user) => {
          setNick('');
          onCreated?.(user);
        },
      },
    );
  };

  return (
    <div className="user-creator">
      <div className="user-row">
        <AvatarImage avatar={avatar} size={36} />
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // Enter dodaje użytkownika, a nie wysyła okna zadania
              submit();
            }
          }}
          placeholder={t('users.nickPlaceholder')}
          maxLength={24}
          aria-label={t('users.nickNew')}
        />
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} name="new-user-avatar" />
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={!nick.trim() || create.isPending} onClick={submit}>
          {t('users.addUser')}
        </button>
      </div>
    </div>
  );
}

/**
 * Wybór użytkowników zadania (jak tagi): wybrani (klik = zdejmij), pozostali (klik = przypisz) oraz możliwość
 * utworzenia nowego użytkownika bez wychodzenia z okna zadania.
 */
export function UserPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const users = useUsers();
  const [creating, setCreating] = useState(false);
  const all = users.data ?? [];
  const selected = value.map((id) => all.find((u) => u.id === id)).filter((u): u is User => !!u);
  const available = all.filter((u) => !value.includes(u.id));

  return (
    <div className="tag-picker">
      {selected.length > 0 && (
        <div className="chips" aria-label={t('form.users')}>
          {selected.map((u) => (
            <button
              key={u.id}
              type="button"
              className="chip chip-on user-chip"
              title={t('users.unassign')}
              onClick={() => onChange(value.filter((id) => id !== u.id))}
            >
              <AvatarImage avatar={u.avatar} size={20} />
              {u.nick} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="chips" aria-label={t('users.available')}>
          {available.map((u) => (
            <button key={u.id} type="button" className="chip user-chip" onClick={() => onChange([...value, u.id])}>
              <AvatarImage avatar={u.avatar} size={20} />+ {u.nick}
            </button>
          ))}
        </div>
      )}
      {all.length === 0 && !creating && <p className="muted small">{t('users.noneBelow')}</p>}
      {creating ? (
        <NewUserForm
          onCancel={() => setCreating(false)}
          onCreated={(user) => {
            onChange([...value, user.id]); // nowy użytkownik od razu trafia do zadania
            setCreating(false);
          }}
        />
      ) : (
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          {t('users.newUser')}
        </button>
      )}
    </div>
  );
}

function UserRow({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState(user.nick);
  const [avatar, setAvatar] = useState<Avatar>(user.avatar);
  const update = useUpdateUser();
  const remove = useDeleteUser();

  if (!editing) {
    return (
      <li className="user-row">
        <AvatarImage avatar={user.avatar} size={36} />
        <span className="user-name">{user.nick}</span>
        <button type="button" className="btn" onClick={() => setEditing(true)} aria-label={t('users.editAria', { nick: user.nick })}>
          {t('common.edit')}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={remove.isPending}
          aria-label={t('users.deleteAria', { nick: user.nick })}
          onClick={async () => {
            const ok = await askConfirm({
              title: t('users.deleteTitle'),
              message: t('users.deleteMessage', { nick: user.nick }),
              confirmLabel: t('users.deleteConfirm'),
            });
            if (ok) remove.mutate(user.id);
          }}
        >
          {t('common.delete')}
        </button>
      </li>
    );
  }

  const save = () => {
    const trimmed = nick.trim();
    if (!trimmed) return;
    update.mutate({ id: user.id, nick: trimmed, avatar }, { onSuccess: () => setEditing(false) });
  };

  return (
    <li className="user-creator">
      <div className="user-row">
        <AvatarImage avatar={avatar} size={36} />
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), save())}
          maxLength={24}
          aria-label={t('users.nickOf', { nick: user.nick })}
          autoFocus
        />
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} name={`avatar-${user.id}`} />
      <div className="form-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setNick(user.nick);
            setAvatar(user.avatar);
            setEditing(false);
          }}
        >
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" disabled={!nick.trim() || update.isPending} onClick={save}>
          {t('common.save')}
        </button>
      </div>
    </li>
  );
}

/** Okno zarządzania użytkownikami: dodawanie, zmiana nicka i awatara oraz usuwanie. */
export function UserManager({ onClose }: { onClose: () => void }) {
  const users = useUsers();
  const [adding, setAdding] = useState(false);
  return (
    <Modal title={t('users.title')} onClose={onClose}>
      {users.isPending && <p className="muted">{t('app.loading')}</p>}
      {users.data && users.data.length === 0 && !adding && (
        <p className="muted">{t('users.emptyManager')}</p>
      )}
      <ul className="user-list">{users.data?.map((u) => <UserRow key={u.id} user={u} />)}</ul>
      {adding ? (
        <NewUserForm onCancel={() => setAdding(false)} onCreated={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          {t('users.addButton')}
        </button>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </Modal>
  );
}
