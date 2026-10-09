import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { setUnauthorizedHandler } from './api';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ConnectionBanner } from './components/ConnectionBanner';
import { LanguageSelect } from './components/LanguageSelect';
import { LogoIcon } from './components/Logo';
import { ThemeSwitch } from './components/ThemeSwitch';
import { t, useLang } from './i18n';
import { Toasts } from './components/Toasts';
import { LoginPage } from './pages/LoginPage';
import { ProjectPage } from './pages/ProjectPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { useLogout, useMe } from './queries';
import { setSession } from './queries/auth';
import { useRealtime } from './realtime';

/** Sticky pasek u góry z logo, przełącznikiem motywu i (po zalogowaniu) przyciskiem wylogowania. */
function TopBar({ user }: { user: string | null }) {
  const logout = useLogout();
  useLang(); // pasek renderuje się ponownie po zmianie języka (reszta aplikacji montuje się od nowa przez `key`)
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <LogoIcon />
        <span className="brand-text">TodoFrenzy</span>
      </Link>
      <span className="spacer" />
      {user && (
        <button type="button" className="btn btn-sm logout-btn" onClick={() => logout.mutate()} disabled={logout.isPending} title={t('app.loggedInAs', { user })}>
          {t('app.logout')}
        </button>
      )}
      <LanguageSelect />
      <ThemeSwitch />
    </header>
  );
}

/** Aplikacja dla zalogowanych: trasy, baner połączenia i połączenie realtime (działa tylko przy ważnej sesji). */
function AuthedApp() {
  useRealtime();
  return (
    <>
      <ConnectionBanner />
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:id" element={<ProjectPage />} />
        <Route
          path="*"
          element={
            <div className="notice">
              <p>{t('app.notFound')}</p>
              <Link to="/" className="btn">
                {t('app.backToProjects')}
              </Link>
            </div>
          }
        />
      </Routes>
    </>
  );
}

export function App() {
  const qc = useQueryClient();
  const me = useMe();

  // Wygasła sesja (401 z dowolnego zapytania) = wracamy do logowania; dane z pamięci czyścimy
  useEffect(() => {
    setUnauthorizedHandler(() => setSession(qc, null));
    return () => setUnauthorizedHandler(null);
  }, [qc]);

  const loggedIn = !!me.data;
  const lang = useLang();
  return (
    <BrowserRouter>
      <TopBar user={me.data?.user ?? null} />
      {/* key={lang}: po zmianie języka drzewo montuje się od nowa, więc wszystkie teksty (t()) odświeżają się bez hooków w każdym komponencie */}
      <main className="shell" key={lang}>
        {me.isPending && <p className="muted">{t('app.loading')}</p>}
        {me.isError && (
          <div className="notice">
            <p>{t('app.serverError', { error: me.error.message })}</p>
            <button type="button" className="btn" onClick={() => me.refetch()}>
              {t('app.retry')}
            </button>
          </div>
        )}
        {me.data === null && <LoginPage />}
        {loggedIn && <AuthedApp />}
      </main>
      <ConfirmDialog />
      <Toasts />
    </BrowserRouter>
  );
}
