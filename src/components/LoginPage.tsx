import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Pill, AlertCircle } from 'lucide-react';
import type { UserRole } from '../types/medication';

interface LoginPageProps {
  onLogin: (netId: string, preferredRole: UserRole) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [netId, setNetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rolePreference, setRolePreference] = useState<UserRole>('pharmacy_staff');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!netId.trim()) {
      setError('Please enter your Net ID');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      onLogin(netId.trim(), rolePreference);
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
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
          <h1 className="text-2xl font-bold">EFWP Formulary</h1>
          <p className="text-muted-foreground">Emory Farmworker Project</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your Net ID to access the medication formulary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="netId">Net ID</Label>
                <Input
                  id="netId"
                  type="text"
                  placeholder="Enter your Net ID"
                  value={netId}
                  onChange={(e) => setNetId(e.target.value)}
                  disabled={isLoading}
                  className="w-full"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Role for this session (dev only)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={rolePreference === 'pharmacy_staff' ? 'default' : 'outline'}
                    onClick={() => setRolePreference('pharmacy_staff')}
                    disabled={isLoading}
                  >
                    Pharmacy Staff
                  </Button>
                  <Button
                    type="button"
                    variant={rolePreference === 'provider' ? 'default' : 'outline'}
                    onClick={() => setRolePreference('provider')}
                    disabled={isLoading}
                  >
                    Provider
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="size-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>For clinic staff and providers only</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Mobile Clinic Medication Management System</p>
        </div>
      </div>
    </div>
  );
}
