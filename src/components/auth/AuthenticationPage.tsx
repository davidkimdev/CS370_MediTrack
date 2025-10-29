import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type AuthMode = 'login' | 'register' | 'forgot-password';

export function AuthenticationPage() {
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <>
      {mode === 'login' && (
        <LoginForm 
          onSwitchToRegister={() => setMode('register')}
          onSwitchToReset={() => setMode('forgot-password')}
        />
      )}
      {mode === 'register' && (
        <RegisterForm onSwitchToLogin={() => setMode('login')} />
      )}
      {mode === 'forgot-password' && (
        <ForgotPasswordForm onBackToLogin={() => setMode('login')} />
      )}
    </>
  );
}