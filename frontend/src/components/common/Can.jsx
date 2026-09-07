import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../constants/permissions';

export default function Can({ permission, children }) {
  const { user } = useAuth();
  if (!hasPermission(user?.role_name, permission)) return null;
  return children;
}
