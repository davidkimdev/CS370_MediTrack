import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
    <Toaster
      position="bottom-right"
      expand
      richColors
      closeButton
      offset={24}
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#1f2937',
          border: '1px solid rgba(15, 23, 42, 0.1)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
          borderRadius: '18px',
          padding: '20px 24px',
          fontSize: '0.95rem',
          minWidth: '360px',
          maxWidth: '420px',
        },
      }}
    />
  </AuthProvider>
);
