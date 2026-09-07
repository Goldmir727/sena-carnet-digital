import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { accessToken, user } = useAuth();

  if (!accessToken) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
