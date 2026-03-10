import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'operator' | 'viewer';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (requiredRole && !hasPermission(requiredRole)) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground">
            You need <span className="text-primary font-medium">{requiredRole}</span> permissions.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
