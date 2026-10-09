import { useState, type FormEvent } from 'react';
import { LogoMark } from '../components/Logo';
import { t } from '../i18n';
import { useLogin } from '../queries';

/** Ekran logowania. Pokazuje się zamiast aplikacji, dopóki nie ma ważnej sesji (adres w pasku zostaje, więc po zalogowaniu wracamy na tę samą stronę). */
export function LoginPage() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !password) return;
    login.mutate({ user: user.trim(), password });
  };

  return (
    <section className="card login-card" aria-labelledby="login-title">
      <header className="login-head">
        <LogoMark />
        <h1 id="login-title" className="card-title">
          {t('login.title')}
        </h1>
        <p className="muted small">{t('login.subtitle')}</p>
      </header>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>{t('login.user')}</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />
        </label>
        <label className="field">
          <span>{t('login.password')}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {login.isError && (
          <p className="form-error" role="alert">
            {login.error.message}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={login.isPending || !user.trim() || !password}>
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
    </section>
  );
}
