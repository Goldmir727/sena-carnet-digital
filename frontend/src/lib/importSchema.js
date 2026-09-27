// Esquema de la carga masiva de estudiantes.
// Espejo frontend de EXCEL_ALIAS (modules/users/user_service.py):
// si se agregan alias allá, agregarlos aquí para la vista previa.
export const COLUMNAS_REQUERIDAS = ['nombres', 'apellidos', 'numero_documento', 'email'];
export const COLUMNAS_OPCIONALES = ['tipo_documento', 'tipo_sangre'];
export const COLUMNAS_TODAS = [...COLUMNAS_REQUERIDAS, ...COLUMNAS_OPCIONALES];

export const ALIASES = {
  nombres: ['nombres', 'nombre', 'names', 'first_name'],
  apellidos: ['apellidos', 'apellido', 'last_name'],
  numero_documento: [
    'numero_documento', 'documento', 'num_documento', 'nro_documento',
    'document', 'cedula', 'cédula',
  ],
  email: ['email', 'correo', 'correo_electronico', 'mail', 'e-mail'],
  tipo_documento: ['tipo_documento', 'tipo_doc', 'tipodoc'],
  tipo_sangre: ['tipo_sangre', 'sangre', 'grupo_sanguineo', 'rh'],
};

export const TIPOS_DOC = ['CC', 'CE', 'TI', 'PEP'];
export const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

export function mapHeaders(headerCells) {
  const header = headerCells.map((c) => norm(c).toLowerCase());
  const idx = {};
  for (const [canonica, aliases] of Object.entries(ALIASES)) {
    const i = header.findIndex((c) => aliases.includes(c));
    if (i >= 0) idx[canonica] = i;
  }
  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !(c in idx));
  return { idx, faltantes };
}

/**
 * Valida filas ya mapeadas a columnas canónicas (vista previa local).
 * No toca la BD: el backend revalida todo al importar.
 */
export function validatePreviewRows(rows) {
  const vistosDoc = new Set();
  const vistosEmail = new Set();
  return rows.map((r) => {
    const doc = norm(r.numero_documento);
    const email = norm(r.email).toLowerCase();
    const tipoDoc = (norm(r.tipo_documento) || 'CC').toUpperCase();
    const sangre = norm(r.tipo_sangre).toUpperCase().replace(/\s+/g, '');
    let error = null;
    if (!norm(r.nombres) || !norm(r.apellidos)) error = 'Nombres y apellidos obligatorios';
    else if (!doc) error = 'Documento obligatorio';
    else if (!email || !EMAIL_RE.test(email)) error = 'Correo inválido';
    else if (!TIPOS_DOC.includes(tipoDoc)) error = `Tipo doc inválido (${TIPOS_DOC.join(', ')})`;
    else if (sangre && !TIPOS_SANGRE.includes(sangre)) error = 'Tipo de sangre inválido';
    else if (doc.length < 6) error = 'Documento mínimo 6 caracteres';
    else if (vistosDoc.has(doc)) error = 'Documento duplicado en el archivo';
    else if (vistosEmail.has(email)) error = 'Correo duplicado en el archivo';
    if (!error) {
      vistosDoc.add(doc);
      vistosEmail.add(email);
    }
    return { ...r, _ok: !error, _error: error };
  });
}
