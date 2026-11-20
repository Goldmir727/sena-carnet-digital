import { renderToString } from 'react-dom/server';
import PublicHome from './pages/PublicHome';
import PublicGuide from './pages/PublicGuide';
import NotFound from './pages/NotFound';

export function renderPage(path) {
  const Page = path === '/' ? PublicHome : path === '/guia' ? PublicGuide : NotFound;
  return renderToString(<Page />);
}
