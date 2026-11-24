export const ROLE_PERMISSIONS = {
  Coordinador: [
    'dashboard.view',
    'users.read',
    'users.write',
    'grupos.read',
    'grupos.write',
    'centros.read',
    'centros.write',
    'programas.read',
    'carnet.view',
    'carnet.write',
    'qr.carnet',
    'reports.view',
    'asistencia.grupo.read',
    'asistencia.excel',
    'validar.qr',
  ],
  Docente: [
    'dashboard.view',
    'grupos.mine',
    'qr.clase',
    'asistencia.grupo.read',
    'asistencia.excel',
    'carnet.view',
    'qr.carnet',
  ],
  Aprendiz: ['dashboard.view', 'carnet.view', 'qr.carnet', 'asistencia.escanear'],
  Funcionario: ['dashboard.view', 'carnet.view', 'qr.carnet'],
  Validador: ['dashboard.view', 'carnet.view', 'validar.qr'],
};

export function hasPermission(roleName, permission) {
  if (!roleName) return false;
  const perms = ROLE_PERMISSIONS[roleName] || [];
  return perms.includes(permission);
}
