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

  const loadUserState = useCallback(async (supabaseUser: SupabaseUser | null, retryCount = 0) => {
    if (!supabaseUser) {
      setUser(null);
      setProfile(null);
      return;
    }

    try {
      const secondaryEmails = Array.isArray(supabaseUser.user_metadata?.secondary_emails)
        ? (supabaseUser.user_metadata.secondary_emails as string[])
        : [];

      console.log(`🔍 Attempting to load profile (attempt ${retryCount + 1}/3)...`);
      const loadedProfile = await AuthService.getUserProfile(supabaseUser.id);

      setProfile(loadedProfile);
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email ?? '',
        secondaryEmails,
        profile: loadedProfile ?? undefined,
      });
      console.log('✅ Profile loaded successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load profile (attempt ${retryCount + 1}):`, errorMsg);

      // If it's a timeout or auth error and we haven't retried too many times, retry
      if (retryCount < 2 && (errorMsg.includes('timeout') || errorMsg.includes('JWT') || errorMsg.includes('auth'))) {
        console.log(`🔄 Retrying in ${(retryCount + 1) * 1000}ms...`);
        // Wait a bit for token refresh to complete, then retry
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));

        // Get fresh session before retrying
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          return loadUserState(session.user, retryCount + 1);
        }
      }

      logger.error(
        'Failed to load user state after retries',
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

  // Initialize auth state - refresh token first, THEN set up listeners
  useEffect(() => {
    let mounted = true;
    let isInitialized = false;

    console.log('🔷 AuthContext: Initializing auth...');

    const initAuth = async () => {
      if (!mounted || isInitialized) return;

      try {
        console.log('🔷 Getting current session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!currentSession) {
          console.log('🔷 No session found');
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          isInitialized = true;
          return;
        }

        console.log('🔷 Session found, checking if token needs refresh...');

        // Calculate if token is expired or close to expiring
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

        console.log(`🔷 Token expires in ${timeUntilExpiry} seconds`);

        let validSession = currentSession;

        // If token expires in less than 60 seconds, refresh it now
        if (timeUntilExpiry < 60) {
          console.log('🔷 Token expired or expiring soon, refreshing...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('🔷 Token refresh failed:', refreshError);
            // Sign out and clear session if refresh fails
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setIsLoading(false);
            isInitialized = true;
            return;
          }

          if (refreshedSession) {
            console.log('🔷 Token refreshed successfully!');
            validSession = refreshedSession;
          }
        } else {
          console.log('🔷 Token is still valid');
        }

        if (validSession?.user && mounted) {
          await loadUserState(validSession.user);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('🔷 Init error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        if (mounted) {
          isInitialized = true;
          setIsLoading(false);
        }
      }
    };

    // CRITICAL: Run initAuth BEFORE setting up the listener
    // This ensures token is refreshed before any SIGNED_IN events fire
    initAuth().then(() => {
      if (!mounted) return;

      console.log('🔷 Setting up auth state listener...');

      // NOW set up the listener (after init is complete)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted || !isInitialized) return;

          console.log('🔷 Auth event:', event);

          if (event === 'SIGNED_IN' && session?.user) {
            console.log('🔷 SIGNED_IN - Loading user');
            await loadUserState(session.user);
            setIsLoading(false);
          } else if (event === 'SIGNED_OUT') {
            console.log('🔷 SIGNED_OUT - Clearing user');
            setUser(null);
            setProfile(null);
            setIsLoading(false);
          } else if (event === 'USER_UPDATED' && session?.user) {
            console.log('🔷 USER_UPDATED - Refreshing user');
            await loadUserState(session.user);
          }
          // Ignore TOKEN_REFRESHED and INITIAL_SESSION
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    });

    return () => {
      mounted = false;
    };
  }, [loadUserState]);

  const signIn = async (email: string, password: string) => {
    console.log('🔷 Sign-in starting for:', email);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      console.log('🔷 Sign-in successful - auth state change will load user');
      // Don't manually load user state - let onAuthStateChange handle it
    } catch (error) {
      console.error('🔷 Sign-in failed:', error);
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