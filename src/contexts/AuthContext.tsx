import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';
import type { AuthUser, UserProfile, AuthContextType, RegistrationData } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  console.log('🔸 AuthProvider initialized');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserState = useCallback(async (supabaseUser: SupabaseUser | null) => {
    if (!supabaseUser) {
      setUser(null);
      setProfile(null);
      return;
    }

    try {
      const secondaryEmails = Array.isArray(supabaseUser.user_metadata?.secondary_emails)
        ? (supabaseUser.user_metadata.secondary_emails as string[])
        : [];

      const loadedProfile = await AuthService.getUserProfile(supabaseUser.id);

      setProfile(loadedProfile);
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email ?? '',
        secondaryEmails,
        profile: loadedProfile ?? undefined,
      });
    } catch (error) {
      logger.error(
        'Failed to load user state',
        error instanceof Error ? error : new Error(String(error)),
      );

      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email ?? '',
        secondaryEmails: [],
        profile: undefined,
      });
    }
  }, []);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      console.warn('🔷 AuthContext: Fallback timeout triggered - forcing loading to false');
      setIsLoading(false);
    }, 15000); // 15 second max loading time

    return () => clearTimeout(fallbackTimeout);
  }, []);

  // Simplified initialization - no profile fetching on startup
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('🔷 AuthContext: Quick initialization starting...');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          await loadUserState(session?.user ?? null);
        }
      } catch (error) {
        console.error('🔷 AuthContext: Quick init error:', error);
      } finally {
        if (mounted) {
          console.log('🔷 AuthContext: Quick init complete, loading = false');
          setIsLoading(false);
        }
      }
    };

    // Start initialization immediately with short delay
    setTimeout(initializeAuth, 100);

    // Simplified auth state listener - no async operations to prevent loops
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔷 Auth event:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🔷 Setting user from sign-in event');
          await loadUserState(session.user);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          console.log('🔷 Clearing user from sign-out event');
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
        // Ignore TOKEN_REFRESHED to avoid loops
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('🔷 Fast sign-in starting for:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      console.log('🔷 Sign-in successful, refreshing user state');
      await loadUserState(data.user ?? null);
      setIsLoading(false);
    } catch (error) {
      console.error('🔷 AuthContext: Sign-in failed:', error);
      throw error;
    }
  };

  const signUp = async (data: RegistrationData) => {
    console.log('🟦 AuthContext.signUp called', { email: data.email });
    try {
      console.log('🟦 Calling AuthService.signUp...');
      await AuthService.signUp(data);
      console.log('🟦 AuthService.signUp successful');
      logger.info('User registered successfully', { email: data.email });
    } catch (error) {
      console.error('🟦 AuthContext.signUp failed:', error);
      logger.error('Registration failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      console.log('🟦 AuthContext.signUp completed');
    }
  };

  const signOut = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
      setProfile(null);
      logger.info('User signed out successfully');
    } catch (error) {
      logger.error('Sign out failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await AuthService.resetPassword(email);
      logger.info('Password reset requested', { email });
    } catch (error) {
      logger.error('Password reset failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const updatedProfile = await AuthService.updateProfile(user.id, updates);
      setProfile(updatedProfile);
      setUser(prev => prev ? { ...prev, profile: updatedProfile } : null);
      logger.info('Profile updated successfully', { userId: user.id });
    } catch (error) {
      logger.error('Profile update failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  const refreshUser = useCallback(async () => {
    const { data: { user: current } } = await supabase.auth.getUser();
    await loadUserState(current ?? null);
  }, [loadUserState]);

  const contextValue: AuthContextType = {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user && !!profile?.isApproved,
    isApproved: !!profile?.isApproved,
    isGuest: !user,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      logger.warn('Unauthenticated access attempt');
      // You could redirect to login here if needed
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}