import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { renderMetadata } from './site.mjs';

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.head.querySelectorAll('[data-seo]').forEach((tag) => tag.remove());
    document.head.insertAdjacentHTML(
      'beforeend',
      renderMetadata(pathname, { indexable: !import.meta.env.DEV }),
    );
  }, [pathname]);

  return null;
}
