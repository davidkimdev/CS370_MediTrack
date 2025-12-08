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
  const { signIn, user, isApproved, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show pending approval state if user is logged in but not approved
  if (user && !isApproved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="size-12 bg-primary rounded-lg flex items-center justify-center">
                <Pill className="size-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">EFWP Formulary</h1>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl text-center text-amber-600">Pending Approval</CardTitle>
              <CardDescription className="text-center">
                Your account is under review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-amber-800">
                    You are logged in as <strong>{user.email}</strong>.
                  </p>
                  <p className="text-sm text-amber-800">
                    Your account must be approved by an administrator before you can access the full application.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                  Check Status Again
                </Button>
                <Button onClick={() => signOut()} variant="ghost" className="w-full">
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email, password);
      setError('');
    } catch (err) {
      let errorMessage = 'Login failed. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link.';
        } else if (err.message.includes('Too many requests')) {
          errorMessage = 'Too many login attempts. Please wait and try again.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  disabled={isSubmitting}
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
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) {
                        setError('');
                      }
                    }}
                    disabled={isSubmitting}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !email || !password}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={onSwitchToReset}
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
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
