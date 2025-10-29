import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Pill, AlertCircle, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../lib/validations';
import { logger } from '../../utils/logger';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: ''
    }
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess(false);
      
      await resetPassword(data.email);
      
      setSuccess(true);
      logger.info('Password reset email sent', { email: data.email });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email. Please try again.';
      setError(errorMessage);
      logger.error('Password reset failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
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
              <CardTitle className="text-xl text-green-900">Check Your Email</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="space-y-3">
                <p className="text-green-700">
                  We've sent a password reset link to:
                </p>
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-medium">{getValues('email')}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Check your email and follow the instructions to reset your password.
                  The link will expire in 1 hour.
                </p>
              </div>
              
              <div className="pt-4 space-y-3">
                <Button onClick={onBackToLogin} className="w-full">
                  Back to Sign In
                </Button>
                <p className="text-xs text-muted-foreground">
                  Didn't receive the email? Check your spam folder or try again in a few minutes.
                </p>
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
          <h1 className="text-2xl font-bold">EFWP</h1>
          <p className="text-muted-foreground">Reset your password</p>
        </div>

        {/* Reset Password Card */}
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToLogin}
                disabled={isLoading}
                className="p-1 h-8 w-8"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="flex-1" />
            </div>
            <CardTitle className="text-xl text-center">Forgot Password?</CardTitle>
            <CardDescription className="text-center">
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    {...register('email')}
                    disabled={isLoading}
                    className={errors.email ? 'border-destructive pl-10' : 'pl-10'}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Sending reset link...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4" />
                    <span>Send Reset Link</span>
                  </div>
                )}
              </Button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onBackToLogin}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3 mr-1" />
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>For assistance, contact your system administrator</p>
        </div>
      </div>
    </div>
  );
}