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

      // Try cache first if this is a retry (likely after wake/network recovery)
      if (retryCount > 0) {
        try {
          const cachedStr = localStorage.getItem('cached_profile');
          if (cachedStr) {
            const cachedProfile = JSON.parse(cachedStr);
            if (cachedProfile && cachedProfile.id === supabaseUser.id) {
              console.log('✅ Using cached profile for faster recovery');
              setProfile(cachedProfile);
              setUser({
                id: supabaseUser.id,
                email: supabaseUser.email ?? '',
                secondaryEmails,
                profile: cachedProfile,
              });

              // Try to update profile in background (don't wait)
              AuthService.getUserProfile(supabaseUser.id)
                .then(freshProfile => {
                  if (freshProfile) {
                    console.log('✅ Updated profile in background');
                    setProfile(freshProfile);
                    setUser(prev => prev ? { ...prev, profile: freshProfile } : null);
                    localStorage.setItem('cached_profile', JSON.stringify(freshProfile));
                  }
                })
                .catch(err => console.warn('Background profile update failed:', err));

              return; // Exit early with cached profile
            }
          }
        } catch (cacheErr) {
          console.warn('Failed to use cache:', cacheErr);
        }
      }

      // Check if token needs refresh before loading profile
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

        // If token expires in less than 5 minutes, refresh it proactively
        if (timeUntilExpiry < 300) {
          console.log('🔄 Token expiring soon, refreshing before profile load...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            throw new Error('Session expired');
          }

          if (refreshedSession) {
            console.log('✅ Token refreshed successfully');
          }
        }
      }

      // Try to load profile from database
      let loadedProfile: UserProfile | null = null;

      try {
        loadedProfile = await AuthService.getUserProfile(supabaseUser.id);

        if (loadedProfile) {
          localStorage.setItem('cached_profile', JSON.stringify(loadedProfile));
          console.log('✅ Profile loaded successfully from database');
        }
      } catch (profileError) {
        // If profile load fails, try cache before retrying
        const profileErr = profileError instanceof Error ? profileError.message : String(profileError);
        console.warn('⚠️ Profile load failed, trying cache:', profileErr);

        try {
          const cachedStr = localStorage.getItem('cached_profile');
          if (cachedStr) {
            const cachedProfile = JSON.parse(cachedStr);
            if (cachedProfile && cachedProfile.id === supabaseUser.id) {
              console.log('✅ Recovered using cached profile');
              loadedProfile = cachedProfile;

              // Try to refresh in background
              setTimeout(() => {
                AuthService.getUserProfile(supabaseUser.id)
                  .then(fresh => {
                    if (fresh) {
                      console.log('✅ Background profile refresh succeeded');
                      setProfile(fresh);
                      setUser(prev => prev ? { ...prev, profile: fresh } : null);
                      localStorage.setItem('cached_profile', JSON.stringify(fresh));
                    }
                  })
                  .catch(err => console.warn('Background refresh failed:', err));
              }, 2000);
            }
          }
        } catch (cacheErr) {
          console.error('Cache fallback failed:', cacheErr);
        }

        // If cache also failed, re-throw to trigger retry logic
        if (!loadedProfile) {
          throw profileError;
        }
      }

      setProfile(loadedProfile);
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email ?? '',
        secondaryEmails,
        profile: loadedProfile ?? undefined,
      });
      console.log('✅ User state loaded');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load profile (attempt ${retryCount + 1}):`, errorMsg);

      // Try to recover from cache if offline or network error
      if (!navigator.onLine || errorMsg.includes('fetch') || errorMsg.includes('network')) {
          console.log('📴 Offline/Network error detected - attempting to load cached profile');
          try {
              const cachedStr = localStorage.getItem('cached_profile');
              if (cachedStr) {
                  const cachedProfile = JSON.parse(cachedStr);
                  if (cachedProfile && cachedProfile.id === supabaseUser.id) {
                      console.log('✅ Loaded profile from cache');
                      setProfile(cachedProfile);
                      setUser({
                        id: supabaseUser.id,
                        email: supabaseUser.email ?? '',
                        secondaryEmails: Array.isArray(supabaseUser.user_metadata?.secondary_emails) 
                            ? (supabaseUser.user_metadata.secondary_emails as string[]) 
                            : [],
                        profile: cachedProfile,
                      });
                      return;
                  }
              }
          } catch (cacheErr) {
              console.error('❌ Failed to parse cached profile:', cacheErr);
          }
      }

      // If it's a timeout or auth error and we haven't retried too many times, retry
      if (retryCount < 2 && (errorMsg.includes('timeout') || errorMsg.includes('JWT') || errorMsg.includes('auth') || errorMsg.includes('session'))) {
        console.log(`🔄 Retrying in ${(retryCount + 1) * 1000}ms...`);
        // Wait a bit for token refresh to complete, then retry
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));

        // Get fresh session and refresh token before retrying
        const { data: { session } } = await supabase.auth.refreshSession();
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

  // Periodic token refresh check and visibility handler
  useEffect(() => {
    if (!user) return;

    console.log('🔷 Setting up periodic token refresh check...');

    const checkAndRefreshToken = async () => {
      // SKIP CHECK IF OFFLINE
      if (!navigator.onLine) {
        console.log('📴 Offline - skipping session check to prevent logout');
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session found but we have a user, they might have been signed out remotely or session expired completely
        if (!session) {
            if (!navigator.onLine) {
                 console.log('📴 No session found but offline - ignoring');
                 return;
            }
            
            // ATTEMPT RECOVERY: sometimes getSession returns null briefly, but a refresh might still work if we have the token
            console.log('⚠️ No session found during check - attempting force refresh...');
            const { data: { session: recoveredSession }, error: recoveryError } = await supabase.auth.refreshSession();
            
            if (recoveredSession) {
                console.log('✅ Session recovered via force refresh!');
                return;
            }

            // If we are here, both getSession AND refreshSession failed.
            // This means the refresh token is truly dead or invalid.
            console.error('❌ Recovery failed:', recoveryError);

            // DOUBLE CHECK: Are we offline now? Sometimes state changes mid-flight.
            if (!navigator.onLine) {
                 console.log('📴 Offline detected after recovery failure - preserving state instead of logout');
                 return;
            }
            
            console.log('❌ Session unrecoverable - signing out');
            await signOut();
            return;
        }

        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

        // If token expires in less than 10 minutes, refresh it
        if (timeUntilExpiry < 600) {
          console.log('🔄 Periodic refresh: Token expiring soon, refreshing...');
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('❌ Periodic refresh failed:', error);
            // Only sign out if it's a serious auth error (not network) AND we are online
            if (navigator.onLine && (error.message.includes('Refresh Token') || error.message.includes('invalid'))) {
                await signOut();
            }
          } else {
            console.log('✅ Periodic refresh successful');
          }
        }
      } catch (error) {
        console.error('❌ Token refresh check error:', error);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);

    // Also check when returning to the tab
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            console.log('👁️ Tab became visible - checking session...');
            checkAndRefreshToken();
        }
    };

    const handleFocus = () => {
        console.log('👁️ Window focused - checking session...');
        checkAndRefreshToken();
    };

    const handleOnline = () => {
        console.log('📶 Connection restored - verifying session...');
        checkAndRefreshToken();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // Run immediately
    checkAndRefreshToken();

    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('online', handleOnline);
    };
  }, [user]);

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
            
            if (!navigator.onLine) {
                console.log('📴 Refresh failed but offline - preserving session');
            } else {
                // Special handling: if refresh token is missing/invalid, we might be able to recover
                // if we have a valid session stored in localStorage by supabase client
                if (refreshError.message.includes('Refresh Token') || refreshError.message.includes('invalid')) {
                     console.log('⚠️ Refresh token invalid - checking if auto-recovery is possible...');
                     // Wait a moment to see if the client auto-recovers (it sometimes does)
                }
                
                // Sign out and clear session if refresh fails
                await supabase.auth.signOut();
                setUser(null);
                setProfile(null);
                setIsLoading(false);
                isInitialized = true;
                return;
            }
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
            // If offline, ignore involuntary sign-outs (e.g. from failed refresh)
            // Manual sign-out handles state clearing separately
            if (!navigator.onLine) {
                console.log('📴 SIGNED_OUT event detected but offline - preserving state');
                setIsLoading(false);
                return;
            }
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
      logger.info('User signed out successfully');
    } catch (error) {
      logger.error('Sign out failed', error instanceof Error ? error : new Error(String(error)));
      // Don't throw here, just proceed to clear state so user can "leave" the app
    } finally {
      setUser(null);
      setProfile(null);
      localStorage.removeItem('cached_profile');
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