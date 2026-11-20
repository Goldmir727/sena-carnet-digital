import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import PublicHome from '../pages/PublicHome';
import PublicGuide from '../pages/PublicGuide';
import NotFound from '../pages/NotFound';
import { normalizePath, PRIVATE_PAGES } from '../seo/site.mjs';

const PrivateApp = lazy(() => import('./PrivateApp'));

export default function SiteRouter() {
  const { pathname } = useLocation();
  const path = normalizePath(pathname);

  if (path === '/') return <PublicHome />;
  if (path === '/guia') return <PublicGuide />;
  if (!Object.hasOwn(PRIVATE_PAGES, path)) return <NotFound />;

  return (
    <Suspense fallback={<p role="status" className="p-8 text-center">Cargando plataforma…</p>}>
      <PrivateApp />
    </Suspense>
  );
}
