export const SITE_URL = 'https://carnetisena.com';
export const SITE_NAME = 'CarnetiSENA';

export const PUBLIC_PAGES = {
  '/': {
    title: 'CarnetiSENA | Carnet digital y asistencia',
    description:
      'Consulta tu carnet digital y registra tu asistencia en CarnetiSENA. Gestión de usuarios, eventos y validación de acceso para la comunidad SENA.',
  },
  '/guia': {
    title: 'Guía de acceso y carnet digital | CarnetiSENA',
    description:
      'Aprende a ingresar a CarnetiSENA, recuperar tu contraseña, consultar tu carnet digital y registrar asistencia con código QR.',
  },
};

// Solo estas rutas cargan la aplicación autenticada. No incluirlas en el sitemap.
export const PRIVATE_PAGES = {
  '/login': 'Iniciar sesión',
  '/forgot-password': 'Recuperar contraseña',
  '/reset-password': 'Restablecer contraseña',
  '/panel': 'Panel de inicio',
  '/mi-carnet': 'Mi carnet',
  '/usuarios': 'Usuarios',
  '/grupos': 'Grupos',
  '/centros': 'Centros',
  '/programas': 'Programas',
  '/carnets': 'Carnets',
  '/asistencia': 'Asistencia',
  '/escanear-clase': 'Registrar asistencia',
  '/qr-clase': 'QR de clase',
  '/reportes': 'Reportes',
  '/validar': 'Validar acceso',
  '/ayuda': 'Ayuda del panel',
};

export function normalizePath(pathname) {
  return pathname === '/' ? '/' : pathname.replace(/\/$/, '');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

// Se usa tanto en el prerender de Node como al navegar con React.
// Nunca interpolar tokens, consultas ni datos de usuarios en los metadatos.
export function renderMetadata(pathname, { indexable = true } = {}) {
  const path = normalizePath(pathname);
  const page = PUBLIC_PAGES[path];
  const title = page?.title || `${PRIVATE_PAGES[path] || 'Página no encontrada'} | ${SITE_NAME}`;
  const description = page?.description || 'Acceso a la plataforma de carnet digital CarnetiSENA.';
  const tags = [
    `<title data-seo>${escapeHtml(title)}</title>`,
    `<meta data-seo name="description" content="${escapeHtml(description)}" />`,
    `<meta data-seo name="robots" content="${page && indexable ? 'index, follow' : 'noindex, follow'}" />`,
  ];

  if (page) {
    const canonical = `${SITE_URL}${path}`;
    tags.push(
      `<link data-seo rel="canonical" href="${canonical}" />`,
      '<meta data-seo property="og:type" content="website" />',
      '<meta data-seo property="og:locale" content="es_CO" />',
      `<meta data-seo property="og:site_name" content="${SITE_NAME}" />`,
      `<meta data-seo property="og:title" content="${escapeHtml(title)}" />`,
      `<meta data-seo property="og:description" content="${escapeHtml(description)}" />`,
      `<meta data-seo property="og:url" content="${canonical}" />`,
      `<meta data-seo property="og:image" content="${SITE_URL}/logo-sena.png" />`,
      '<meta data-seo property="og:image:width" content="320" />',
      '<meta data-seo property="og:image:height" content="320" />',
      '<meta data-seo property="og:image:alt" content="Logo del SENA" />',
      '<meta data-seo name="twitter:card" content="summary" />',
      `<meta data-seo name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta data-seo name="twitter:description" content="${escapeHtml(description)}" />`,
      `<meta data-seo name="twitter:image" content="${SITE_URL}/logo-sena.png" />`,
      '<meta data-seo name="twitter:image:alt" content="Logo del SENA" />',
    );
    if (path === '/') {
      const website = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: 'Carnet digital SENA',
        url: `${SITE_URL}/`,
        inLanguage: 'es-CO',
      };
      tags.push(`<script data-seo type="application/ld+json">${JSON.stringify(website)}</script>`);
    }
  }

  return tags.join('\n    ');
}
