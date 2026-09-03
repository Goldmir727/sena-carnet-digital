import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../constants/permissions';

export default function PermissionRoute({ permission, children }) {
  const { user } = useAuth();

  if (!hasPermission(user?.role_name, permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
