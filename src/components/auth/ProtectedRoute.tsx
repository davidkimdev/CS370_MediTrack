import { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Pill, Clock, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { logger } from '../../utils/logger';

export type AccessLevel = 'guest' | 'authenticated' | 'approved';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredLevel: AccessLevel;
  fallback?: ReactNode;
  onAccessDenied?: () => void;
}

export function ProtectedRoute({ children, requiredLevel, fallback, onAccessDenied }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Guest access - no authentication required
  if (requiredLevel === 'guest') {
    logger.debug('Allowing guest access to route');
    return <>{children}</>;
  }

  // No user at all - show access denied
  if (!user) {
    logger.debug('No user found, access denied');
    
    if (onAccessDenied) {
      onAccessDenied();
      return null;
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return <AccessDeniedScreen reason="login-required" />;
  }

  // Authenticated access - just need to be logged in
  if (requiredLevel === 'authenticated') {
    logger.debug('User authenticated, allowing access', { 
      userId: user.id, 
      isApproved: user.profile?.isApproved 
    });
    return <>{children}</>;
  }

  // Approved access - need to be approved by admin
  if (requiredLevel === 'approved') {
    if (!user.profile?.isApproved) {
      logger.debug('User not approved, showing pending approval screen', { userId: user.id });
      
      if (fallback) {
        return <>{fallback}</>;
      }
      
      return <PendingApprovalScreen />;
    }
    
    logger.debug('User approved, allowing access', { userId: user.id });
    return <>{children}</>;
  }

  // Should never reach here
  logger.error('Unknown access level', { requiredLevel });
  return <AccessDeniedScreen reason="unknown-error" />;
}

function PendingApprovalScreen() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      console.log('🚪 Sign out button clicked');
      await signOut();
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="size-12 bg-primary rounded-lg flex items-center justify-center">
              <Pill className="size-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">EFWP</h1>
        </div>

        {/* Pending Approval Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 size-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="size-6 text-orange-600" />
            </div>
            <CardTitle className="text-xl text-orange-900">Account Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-3">
              <p className="text-orange-700">
                Your account has been created successfully but is waiting for administrator approval.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="size-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-orange-900">What happens next?</h4>
                    <ul className="text-sm text-orange-800 space-y-1">
                      <li>• An administrator will review your account</li>
                      <li>• You'll receive an email once approved</li>
                      <li>• This process usually takes 1-2 business days</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                If you have questions or need urgent access, please contact your system administrator.
              </p>
            </div>
            
            <div className="pt-4 space-y-3">
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                Sign Out
              </Button>
              <p className="text-xs text-muted-foreground">
                You can sign back in once your account has been approved.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessDeniedScreen({ reason }: { reason: 'login-required' | 'unknown-error' }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="size-12 bg-primary rounded-lg flex items-center justify-center">
              <Pill className="size-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">EFWP</h1>
        </div>

        {/* Access Denied Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 size-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="size-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-900">Access Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {reason === 'login-required' ? (
              <div className="space-y-3">
                <p className="text-red-700">
                  You need to sign in to access this feature.
                </p>
                <p className="text-sm text-muted-foreground">
                  Please sign in with your account to continue.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-red-700">
                  There was an error checking your access permissions.
                </p>
                <p className="text-sm text-muted-foreground">
                  Please try refreshing the page or contact support.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper components for common access patterns
export function GuestRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute requiredLevel="guest">{children}</ProtectedRoute>;
}

export function AuthenticatedRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <ProtectedRoute requiredLevel="authenticated" fallback={fallback}>{children}</ProtectedRoute>;
}

export function ApprovedRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <ProtectedRoute requiredLevel="approved" fallback={fallback}>{children}</ProtectedRoute>;
}