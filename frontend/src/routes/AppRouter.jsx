import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import PermissionRoute from './PermissionRoute';
import AppLayout from '../components/layout/AppLayout';
import Login from '../pages/Login';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import Dashboard from '../pages/Dashboard';
import NotFound from '../pages/NotFound';
import ModulePlaceholder from '../pages/ModulePlaceholder';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />

          <Route
            path="mi-carnet"
            element={
              <PermissionRoute permission="carnet.view">
                <ModulePlaceholder title="Mi carnet" />
              </PermissionRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <PermissionRoute permission="users.read">
                <ModulePlaceholder title="Usuarios" />
              </PermissionRoute>
            }
          />
          <Route
            path="grupos"
            element={
              <PermissionRoute permission="grupos.read">
                <ModulePlaceholder title="Grupos" />
              </PermissionRoute>
            }
          />
          <Route
            path="carnets"
            element={
              <PermissionRoute permission="carnet.write">
                <ModulePlaceholder title="Gestión de carnets" />
              </PermissionRoute>
            }
          />
          <Route
            path="asistencia"
            element={
              <PermissionRoute permission="asistencia.grupo.read">
                <ModulePlaceholder title="Asistencia" />
              </PermissionRoute>
            }
          />
          <Route
            path="escanear-clase"
            element={
              <PermissionRoute permission="asistencia.escanear">
                <ModulePlaceholder title="Registrar asistencia" />
              </PermissionRoute>
            }
          />
          <Route
            path="qr-clase"
            element={
              <PermissionRoute permission="qr.clase">
                <ModulePlaceholder title="QR de clase" />
              </PermissionRoute>
            }
          />
          <Route
            path="reportes"
            element={
              <PermissionRoute permission="reports.view">
                <ModulePlaceholder title="Reportes" />
              </PermissionRoute>
            }
          />
          <Route
            path="validar"
            element={
              <PermissionRoute permission="validar.qr">
                <ModulePlaceholder title="Validar acceso" />
              </PermissionRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
