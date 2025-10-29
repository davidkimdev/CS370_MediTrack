import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Pill, AlertCircle, Eye, EyeOff, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useAuth } from '../../contexts/AuthContext';
import { registerSchema, type RegisterFormData } from '../../lib/validations';
import { logger } from '../../utils/logger';

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

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      invitationCode: ''
    }
  });

  const invitationCode = watch('invitationCode');
  const hasInvitationCode = invitationCode && invitationCode.trim().length > 0;

  const onSubmit = async (data: RegisterFormData) => {
    console.log('🟢 Register form submitted!', { 
      email: data.email, 
      firstName: data.firstName,
      lastName: data.lastName,
      hasInvitationCode: Boolean(data.invitationCode),
      passwordLength: data.password.length 
    });
    
    try {
      setIsLoading(true);
      setError('');
      setSuccess(false);
      
      console.log('🟢 Attempting to register user...', { email: data.email });
      await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        invitationCode: data.invitationCode || undefined
      });
      
      console.log('✅ User registered successfully!', { email: data.email });
      setSuccess(true);
      logger.info('User registered successfully', { email: data.email, hasInvitation: hasInvitationCode });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      console.error('❌ Registration failed:', errorMessage);
      setError(errorMessage);
      logger.error('Registration failed', err instanceof Error ? err : new Error(String(err)));
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
            <form 
              onSubmit={handleSubmit(onSubmit, (errors) => {
                console.log('❌ Register form validation failed:', errors);
                setError('Please fill in all required fields correctly.');
              })} 
              className="space-y-4"
            >
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
                  {...register('invitationCode')}
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
                    {...register('firstName')}
                    disabled={isLoading}
                    className={errors.firstName ? 'border-destructive' : ''}
                    autoComplete="given-name"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    {...register('lastName')}
                    disabled={isLoading}
                    className={errors.lastName ? 'border-destructive' : ''}
                    autoComplete="family-name"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  {...register('email')}
                  disabled={isLoading}
                  className={errors.email ? 'border-destructive' : ''}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    {...register('password')}
                    disabled={isLoading}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
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
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
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
                    {...register('confirmPassword')}
                    disabled={isLoading}
                    className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
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
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Test Button First */}
              <button
                type="button"
                onClick={() => {
                  console.log('🧪 TEST: Register button click works!');
                  alert('Register button clicking works! This is a test button.');
                }}
                className="w-full mb-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                🧪 TEST REGISTER BUTTON (Click to verify button works)
              </button>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading}
                onClick={(e) => {
                  console.log('🟢 Register button clicked!', { 
                    isLoading, 
                    formValid: Object.keys(errors).length === 0,
                    errors: errors 
                  });
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
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