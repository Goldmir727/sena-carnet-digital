// Constantes y utilidades compartidas por la vista previa (React) y el PDF
// (jsPDF). Todas las medidas están en milímetros sobre una tarjeta CR80
// vertical (53,98 × 85,6 mm), que es el formato físico del carnet.

export const CARNET = {
  width: 53.98,
  height: 85.6,
  // Escala interna de la vista previa: 1 mm = 10 px antes de aplicar el
  // factor de ajuste responsive.
  pxPerMm: 10,
};

export const CARNET_COLORS = {
  greenBand: '#00AE25',
  green: '#00A651',
  greenLogo: '#00AF00',
  ink: '#777783',
  muted: '#9E9EA6',
  line: '#E5E5E5',
  white: '#FFFFFF',
  photoBg: '#F4F4F5',
  photoInk: '#B8B8BE',
  bottomBand: '#777783',
};

// Posiciones y tamaños medidos sobre la referencia institucional.
export const CARNET_LAYOUT = {
  topBand: { y: 0, h: 1.8 },
  logo: { x: 6.0, y: 9.6, w: 14.0, h: 13.7 },
  photo: { x: 29.05, y: 5.6, size: 21.2 },
  divider: { y: 31.0, h: 1.0 },
  contentX: 5.1,
  contentW: 43.78,
  name1: { y: 36.1, size: 10 },
  name2: { y: 40.2, size: 10 },
  doc: { y: 45.0, size: 5.6 },
  badge: { y: 48.2, h: 4.2, radius: 1.4, size: 5.6 },
  qrPanel: { x: 5.1, y: 53.2, w: 43.78, h: 18.0, radius: 9.0 },
  qr: { size: 16.0 },
  centro: { y: 72.8, size: 5.4 },
  programa: { y: 75.2, size: 5.4, line: 2.4 },
  bottomBand: { y: 81.9, h: 3.7, size: 6.0 },
};

export const LOGO_URL = `${import.meta.env.BASE_URL || '/'}carnet-logo-sena.png`;

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function mmToPx(mm) {
  return Number(mm) * CARNET.pxPerMm;
}

// Tamaño de fuente en puntos -> píxeles de la escala de diseño.
export function ptToPx(pt) {
  return Number(pt) * (25.4 / 72) * CARNET.pxPerMm;
}

export function ptToMm(pt) {
  return Number(pt) * (25.4 / 72);
}

export function photoUrl(foto) {
  if (!foto) return null;
  if (/^(https?:|data:|blob:)/i.test(foto)) return foto;
  const clean = String(foto).replace(/\\/g, '/').replace(/^\/+/, '');
  return `${API_BASE}/${clean}`;
}

export function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

// Normaliza la respuesta del carnet + los datos del usuario a un único
// modelo, sin inventar valores. La vista previa y el PDF consumen este mismo
// modelo.
export function buildCarnetData(carnet = {}, user = {}) {
  const c = carnet || {};
  const u = user || {};
  return {
    ...c,
    nombres: u.nombres || u.name || c.nombres || c.usuario_nombre || '',
    apellidos: u.apellidos || u.last_name || c.apellidos || '',
    tipo_documento: u.tipo_documento || u.document_type || c.tipo_documento || '',
    numero_documento:
      u.numero_documento || u.document || c.numero_documento || c.usuario_documento || '',
    tipo_sangre: u.tipo_sangre || u.blood_type || c.tipo_sangre || '',
    foto_perfil: u.foto_perfil || c.foto_perfil || null,
    rol_nombre: c.rol_nombre || c.role_name || u.rol_nombre || u.role_name || '',
    centro_nombre: c.centro_nombre || u.centro_nombre || c.centro || '',
    programa_nombre: c.programa_nombre || u.programa_nombre || c.programa || '',
    regional: c.regional || u.regional || '',
  };
}

export function documentLine(data) {
  const tipo = String(data?.tipo_documento || 'DOC').trim().toUpperCase();
  const numero = String(data?.numero_documento || '—').trim();
  const rh = String(data?.tipo_sangre || '—').trim().toUpperCase();
  return `${tipo}: ${numero} / RH: ${rh}`;
}

export function roleLabel(data) {
  return String(data?.rol_nombre || 'Usuario SENA').trim();
}

export function regionalLabel(value) {
  const regional = String(value || '').replace(/\s+/g, ' ').trim();
  if (!regional) return 'REGIONAL NO DISPONIBLE';
  const upper = regional.toUpperCase();
  return upper.startsWith('REGIONAL') ? upper : `REGIONAL ${upper}`;
}
