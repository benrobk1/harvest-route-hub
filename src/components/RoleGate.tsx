import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'farmer' | 'lead_farmer' | 'driver' | 'consumer';

interface RoleGateProps {
  roles: AppRole[];
  children: React.ReactNode;
  fallbackPath?: string;
}

export const RoleGate = ({ roles, children, fallbackPath = '/' }: RoleGateProps) => {
  const { user, roles: userRoles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/');
      } else if (!roles.some(role => userRoles.includes(role))) {
        navigate(fallbackPath);
      }
    }
  }, [user, userRoles, loading, navigate, roles, fallbackPath]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || !roles.some(role => userRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
};
