import {
  LayoutDashboard,
  Users,
  Network,
  CreditCard,
  ClipboardCheck,
  QrCode,
  FileBarChart2,
  ScanLine,
  IdCard,
  Clock3,
} from 'lucide-react';

export const MENU_ITEMS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
  { to: '/mi-carnet', label: 'Mi carnet', icon: IdCard, permission: 'carnet.view' },
  { to: '/usuarios', label: 'Usuarios', icon: Users, permission: 'users.read' },
  { to: '/grupos', label: 'Grupos', icon: Network, permission: 'grupos.read' },
  { to: '/carnets', label: 'Gestión de carnets', icon: CreditCard, permission: 'carnet.write' },
  { to: '/asistencia', label: 'Asistencia', icon: ClipboardCheck, permission: 'asistencia.grupo.read' },
  { to: '/llegadas-tarde', label: 'Llegadas tarde', icon: Clock3, permission: 'asistencia.grupo.read' },
  { to: '/qr-clase', label: 'QR de clase', icon: QrCode, permission: 'qr.clase' },
  { to: '/escanear-clase', label: 'Registrar asistencia', icon: ScanLine, permission: 'asistencia.escanear' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2, permission: 'reports.view' },
  { to: '/validar', label: 'Validar acceso', icon: ScanLine, permission: 'validar.qr' },
];

