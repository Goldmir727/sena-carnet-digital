import { createReadStream, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { PRIVATE_PAGES } from '../src/seo/site.mjs';

// Hace que `vite preview` use el mismo shell privado y los mismos 404 que Nginx.
export default function previewPages() {
  return {
    name: 'preview-seo-pages',
    configurePreviewServer(server) {
      const dist = resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((request, response, next) => {
        if (!['GET', 'HEAD'].includes(request.method)) return next();
        const path = new URL(request.url, 'http://localhost').pathname;
        if (path === '/index.html' || path === '/guia/' || path === '/guia/index.html') {
          const query = new URL(request.url, 'http://localhost').search;
          response.writeHead(308, { Location: `${path === '/index.html' ? '/' : '/guia'}${query}` });
          response.end();
          return;
        }
        let file;
        let status = 200;
        if (Object.hasOwn(PRIVATE_PAGES, path.replace(/\/$/, ''))) {
          file = 'app.html';
        } else if (path === '/guia') {
          file = 'guia/index.html';
        } else {
          const requestedFile = resolve(dist, `.${path}`);
          const isAsset = requestedFile.startsWith(`${dist}${sep}`) && statSync(requestedFile, { throwIfNoEntry: false })?.isFile();
          if (path === '/' || (isAsset && !['/app.html', '/404.html'].includes(path))) return next();
          file = '404.html';
          status = 404;
        }
        response.statusCode = status;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (file !== 'guia/index.html') response.setHeader('X-Robots-Tag', 'noindex, follow');
        if (request.method === 'HEAD') response.end();
        else createReadStream(resolve(dist, file)).pipe(response);
      });
    },
  };
}
