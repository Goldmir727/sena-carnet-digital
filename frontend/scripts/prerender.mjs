import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { PUBLIC_PAGES, SITE_URL, renderMetadata } from '../src/seo/site.mjs';

const dist = resolve('dist');
const temporaryBundle = resolve(dist, '.prerender');
const template = await readFile(resolve(dist, 'index.html'), 'utf8');
const headMarker = /<!-- seo:head:start -->[\s\S]*?<!-- seo:head:end -->/;

if (!headMarker.test(template) || !template.includes('<div id="root"></div>')) {
  throw new Error('No se encontraron los marcadores de prerender en index.html.');
}

function pageHtml(path, body = '', { scripts = true } = {}) {
  let html = template.replace(headMarker, renderMetadata(path));
  html = html.replace('<div id="root"></div>', `<div id="root"${body ? ' data-prerendered="true"' : ''}>${body}</div>`);
  // El 404 es estático: no necesita descargar ni ejecutar la aplicación.
  if (!scripts) html = html.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '');
  return html;
}

try {
  // Bundle SSR solo de páginas públicas: nunca carga sesiones, API ni datos personales.
  await build({
    configFile: resolve('vite.config.js'),
    publicDir: false,
    build: {
      ssr: 'src/entry-seo.jsx',
      outDir: temporaryBundle,
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'entry.mjs' } },
    },
  });
  const { renderPage } = await import(pathToFileURL(resolve(temporaryBundle, 'entry.mjs')).href);

  await writeFile(resolve(dist, 'app.html'), pageHtml('/panel'));
  for (const path of Object.keys(PUBLIC_PAGES)) {
    const file = resolve(dist, path === '/' ? 'index.html' : `${path.slice(1)}/index.html`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, pageHtml(path, renderPage(path)));
  }
  await writeFile(resolve(dist, '404.html'), pageHtml('/404', renderPage('/404'), { scripts: false }));
  await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  // No se inventan fechas lastmod ni se incluyen enlaces de recuperación o datos privados.
  const urls = Object.keys(PUBLIC_PAGES).map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
  await writeFile(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log('SEO: portada y guía prerenderizadas; shell privado, 404, robots y sitemap generados.');
} finally {
  await rm(temporaryBundle, { recursive: true, force: true });
}
