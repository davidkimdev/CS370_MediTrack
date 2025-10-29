import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Pill, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToReset: () => void;
}

export function LoginForm({ onSwitchToRegister, onSwitchToReset }: LoginFormProps) {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError('');
      await signIn(email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
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
            <CardTitle className="text-xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to your account to access the medication formulary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Sign In Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !email || !password}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={onSwitchToReset}
                  disabled={isLoading}
                  className="text-sm"
                >
                  Forgot your password?
                </Button>
              </div>
            </form>

            <Separator className="my-6" />
            
            {/* Register Link */}
            <div className="text-center text-sm">
              Don't have an account?{' '}
              <Button
                type="button"
                variant="link"
                onClick={onSwitchToRegister}
                disabled={isLoading}
                className="p-0 h-auto font-semibold"
              >
                Create an account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}