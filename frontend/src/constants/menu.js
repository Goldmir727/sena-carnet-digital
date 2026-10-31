import {
  LayoutDashboard,
  Users,
  Network,
  Building2,
  BookOpen,
  CreditCard,
  ClipboardCheck,
  QrCode,
  FileBarChart2,
  ScanLine,
  HelpCircle,
} from 'lucide-react';

export const MENU_ITEMS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, permission: 'users.read' },
  { to: '/grupos', label: 'Grupos', icon: Network, permission: 'grupos.read' },
  { to: '/centros', label: 'Centros', icon: Building2, permission: 'centros.read' },
  { to: '/programas', label: 'Programas', icon: BookOpen, permission: 'programas.read' },
  { to: '/carnets', label: 'Gestión de carnets', icon: CreditCard, permission: 'carnet.write' },
  { to: '/asistencia', label: 'Asistencia', icon: ClipboardCheck, permission: 'asistencia.grupo.read' },
  { to: '/qr-clase', label: 'QR de clase', icon: QrCode, permission: 'qr.clase' },
  { to: '/escanear-clase', label: 'Registrar asistencia', icon: ScanLine, permission: 'asistencia.escanear' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2, permission: 'reports.view' },
  { to: '/validar', label: 'Validar acceso', icon: ScanLine, permission: 'validar.qr' },
  { to: '/ayuda', label: 'Ayuda', icon: HelpCircle, permission: 'dashboard.view' },
];

