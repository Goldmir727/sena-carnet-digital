import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import PermissionRoute from './PermissionRoute';
import AppLayout from '../components/layout/AppLayout';
import Login from '../pages/Login';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import Dashboard from '../pages/Dashboard';
import MiCarnet from '../pages/MiCarnet';
import Usuarios from '../pages/Usuarios';
import Grupos from '../pages/Grupos';
import Centros from '../pages/Centros';
import Programas from '../pages/Programas';
import Carnets from '../pages/Carnets';
import Asistencia from '../pages/Asistencia';
import RegistrarAsistencia from '../pages/RegistrarAsistencia';
import Reportes from '../pages/Reportes';
import Validar from '../pages/Validar';
import QrClase from '../pages/QrClase';
import Help from '../pages/Help';
import NotFound from '../pages/NotFound';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="panel" element={<Dashboard />} />

          <Route
            path="mi-carnet"
            element={
              <PermissionRoute permission="carnet.view">
                <MiCarnet />
              </PermissionRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <PermissionRoute permission="users.read">
                <Usuarios />
              </PermissionRoute>
            }
          />
          <Route
            path="grupos"
            element={
              <PermissionRoute permission="grupos.read">
                <Grupos />
              </PermissionRoute>
            }
          />
          <Route
            path="centros"
            element={
              <PermissionRoute permission="centros.read">
                <Centros />
              </PermissionRoute>
            }
          />
          <Route
            path="programas"
            element={
              <PermissionRoute permission="programas.read">
                <Programas />
              </PermissionRoute>
            }
          />
          <Route
            path="carnets"
            element={
              <PermissionRoute permission="carnet.write">
                <Carnets />
              </PermissionRoute>
            }
          />
          <Route
            path="asistencia"
            element={
              <PermissionRoute permission="asistencia.grupo.read">
                <Asistencia />
              </PermissionRoute>
            }
          />
          <Route
            path="escanear-clase"
            element={
              <PermissionRoute permission="asistencia.escanear">
                <RegistrarAsistencia />
              </PermissionRoute>
            }
          />
          <Route
            path="qr-clase"
            element={
              <PermissionRoute permission="qr.clase">
                <QrClase />
              </PermissionRoute>
            }
          />
          <Route
            path="reportes"
            element={
              <PermissionRoute permission="reports.view">
                <Reportes />
              </PermissionRoute>
            }
          />
          <Route
            path="validar"
            element={
              <PermissionRoute permission="validar.qr">
                <Validar />
              </PermissionRoute>
            }
          />
          <Route
            path="ayuda"
            element={
              <PermissionRoute permission="dashboard.view">
                <Help />
              </PermissionRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
