import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
    <Toaster 
      position="top-right" 
      expand={true}
      richColors 
      closeButton
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#333333',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }
      }}
    />
  </AuthProvider>
);
