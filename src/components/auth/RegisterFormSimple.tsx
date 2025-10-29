import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Pill, AlertCircle, Eye, EyeOff, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useAuth } from '../../contexts/AuthContext';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  const hasInvitationCode = invitationCode && invitationCode.trim().length > 0;

  const validateForm = () => {
    if (!email) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Please enter a valid email address';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (password !== confirmPassword) return 'Passwords don\'t match';
    if (!firstName) return 'First name is required';
    if (firstName.length < 2) return 'First name must be at least 2 characters';
    if (!lastName) return 'Last name is required';
    if (lastName.length < 2) return 'Last name must be at least 2 characters';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    console.log('🟢 Register form submitted!', { 
      email, 
      firstName,
      lastName,
      hasInvitationCode: Boolean(invitationCode),
      passwordLength: password.length 
    });
    
    try {
      setIsLoading(true);
      setError('');
      setSuccess(false);
      
      console.log('🟢 Attempting to register user...', { email });
      await signUp({
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        invitationCode: invitationCode.trim() || undefined
      });
      
      console.log('✅ User registered successfully!', { email });
      setSuccess(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      console.error('❌ Registration failed:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('🟢 Registration process completed');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 size-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="size-6 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-900">Registration Successful!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {hasInvitationCode ? (
                <div className="space-y-3">
                  <p className="text-green-700">
                    Your account has been created and approved automatically using your invitation code.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can now sign in and access all features.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-green-700">
                    Your account has been created successfully!
                  </p>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Your account is pending approval from an administrator. 
                      You'll receive an email notification once approved.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              <div className="pt-4">
                <Button onClick={onSwitchToLogin} className="w-full">
                  Go to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">Join EFWP</h1>
          <p className="text-muted-foreground">Create your account</p>
        </div>

        {/* Registration Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Fill in your details to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Invitation Code Field */}
              <div className="space-y-2">
                <Label htmlFor="invitationCode">
                  Invitation Code 
                  <span className="text-muted-foreground text-sm font-normal">(Optional)</span>
                </Label>
                <Input
                  id="invitationCode"
                  type="text"
                  placeholder="Enter invitation code if you have one"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="uppercase"
                  maxLength={8}
                />
                {hasInvitationCode && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="size-3" />
                    Account will be approved automatically
                  </p>
                )}
                {!hasInvitationCode && (
                  <p className="text-sm text-muted-foreground">
                    Without an invitation code, your account will need admin approval
                  </p>
                )}
              </div>

              <Separator />

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isLoading}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isLoading}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
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
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be 8+ characters with uppercase, lowercase, and number
                </p>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-6">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={onSwitchToLogin}
                disabled={isLoading}
              >
                Sign In Instead
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>For clinic staff and providers only</p>
        </div>
      </div>
    </div>
  );
}