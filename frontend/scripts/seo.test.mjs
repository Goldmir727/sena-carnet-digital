import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PRIVATE_PAGES, PUBLIC_PAGES, SITE_URL, renderMetadata } from '../src/seo/site.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

for (const [path, page] of Object.entries(PUBLIC_PAGES)) {
  test(`${path}: contenido público disponible sin JavaScript`, async () => {
    const html = await read(`../dist/${path === '/' ? 'index.html' : `${path.slice(1)}/index.html`}`);
    assert.ok(html.includes(`<title data-seo>${page.title}</title>`));
    assert.match(html, /name="robots" content="index, follow"/);
    assert.ok(html.includes(`rel="canonical" href="${SITE_URL}${path}"`));
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
    assert.match(html, /data-prerendered="true"/);
    assert.match(html, /href="\/login"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /name="twitter:card"/);
    assert.doesNotMatch(html, /modulepreload[^>]*PrivateApp/);
  });
}

test('shell privado sin contenido público, canonical ni información personal', async () => {
  const html = await read('../dist/app.html');
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /rel="canonical"|property="og:|data-prerendered/);
  assert.doesNotMatch(html, /Tu carnet digital y tu asistencia/);
  assert.match(html, /<script type="module"/);
});

test('metadatos por ruta sin filtrar tokens a canonicals', () => {
  for (const path of Object.keys(PRIVATE_PAGES)) {
    const html = renderMetadata(path);
    assert.match(html, /noindex, follow/);
    assert.doesNotMatch(html, /canonical|og:url/);
  }
  assert.match(renderMetadata('/no-existe'), /noindex, follow/);
  assert.match(renderMetadata('/', { indexable: false }), /noindex, follow/);
  assert.ok(renderMetadata('/guia/').includes(`rel="canonical" href="${SITE_URL}/guia"`));
});

test('sitemap solo con páginas públicas, sin fechas inventadas ni datos privados', async () => {
  const sitemap = await read('../dist/sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, Object.keys(PUBLIC_PAGES).map((path) => `${SITE_URL}${path}`));
  assert.doesNotMatch(sitemap, /lastmod|changefreq|priority|token|uuid/);
  const robots = await read('../dist/robots.txt');
  assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
  assert.doesNotMatch(robots, /Disallow:\s*\//);
});

test('404 estático, noindex y sin ejecutar la aplicación', async () => {
  const html = await read('../dist/404.html');
  assert.match(html, /Página no encontrada/);
  assert.match(html, /noindex, follow/);
  assert.doesNotMatch(html, /rel="canonical"|<script[^>]*type="module"/);
});

test('favicon SENA cuadrado de 96 px, vinculado desde las páginas', async () => {
  const png = await readFile(new URL('../public/favicon-sena.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 96);
  assert.equal(png.readUInt32BE(20), 96);
  const html = await read('../dist/index.html');
  assert.match(html, /rel="icon"[^>]*href="\/favicon-sena.png"/);
});

test('rutas de Nginx y Vercel en sincronía con el router', async () => {
  const router = await read('../src/routes/AppRouter.jsx');
  const appPaths = [...router.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path !== '*')
    .map((path) => path.startsWith('/') ? path : `/${path}`);
  assert.deepEqual(appPaths.sort(), Object.keys(PRIVATE_PAGES).sort());
  const nginx = await read('../nginx.conf');
  const privatePattern = nginx.match(/location ~ \^\/\(([^)]+)\)/)[1].split('|');
  assert.deepEqual(privatePattern.sort(), Object.keys(PRIVATE_PAGES).map((path) => path.slice(1)).sort());
  assert.ok(nginx.includes('try_files $uri =404;'));
  assert.ok(nginx.includes('return 308 https://carnetisena.com$request_uri;'));
  assert.doesNotMatch(nginx, /try_files \$uri \$uri\/ \/index.html/);
  const vercel = JSON.parse(await read('../../vercel.json'));
  const rewrites = vercel.services.frontend.rewrites;
  assert.ok(!rewrites.some(({ source }) => source === '/(.*)'));
  const route = rewrites.find(({ destination }) => destination === '/app.html');
  const paths = route.source.match(/\(([^)]+)\)/)[1].split('|');
  assert.deepEqual(paths.sort(), privatePattern.sort());
});
