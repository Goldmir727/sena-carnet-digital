import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';

export default function ProtectedRoute() {
  const { accessToken, user } = useAuth();

  if (!accessToken) return <Navigate to="/login" replace />;
  if (!user) return <Spinner fullScreen />;

  return <Outlet />;
}
