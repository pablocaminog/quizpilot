import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import Dashboard from '@/components/views/dashboard';
import Workspace from '@/components/views/workspace';
import Game from '@/components/views/game';
import Play, { PlayEntry } from '@/components/views/play';

export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function matchPath(pathname) {
  let m = pathname.match(/^\/host\/quiz\/([A-Za-z0-9_-]+)$/);
  if (m) return { view: 'host', quizId: m[1] };
  m = pathname.match(/^\/play\/([A-Z0-9]{6})$/i);
  if (m) return { view: 'play', joinCode: m[1].toUpperCase() };
  m = pathname.match(/^\/game\/([A-Z0-9]{6})$/i);
  if (m) return { view: 'game', joinCode: m[1].toUpperCase() };
  if (pathname === '/play') return { view: 'playEntry' };
  return { view: 'home' };
}

const HOST_VIEWS = new Set(['home', 'host', 'game']);

export default function AppShell() {
  const [route, setRoute] = useState(() => matchPath(window.location.pathname));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onPop = () => setRoute(matchPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!HOST_VIEWS.has(route.view)) {
      setReady(true);
      return;
    }
    // Host cookie is an idempotent opaque session — create once per mount.
    api('hostSession', {}, { body: {} })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  let view = null;
  if (route.view === 'home') view = <Dashboard />;
  else if (route.view === 'host') view = <Workspace quizId={route.quizId} />;
  else if (route.view === 'game') view = <Game joinCode={route.joinCode} />;
  else if (route.view === 'play') view = <Play joinCode={route.joinCode} />;
  else view = <PlayEntry />;
  return (
    <TooltipProvider>
      {(ready || !HOST_VIEWS.has(route.view)) && view}
      <Toaster position={route.view === 'play' || route.view === 'playEntry' ? 'bottom-center' : 'bottom-right'} />
    </TooltipProvider>
  );
}
