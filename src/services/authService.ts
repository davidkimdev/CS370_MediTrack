import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { AuthUser, UserProfile, RegistrationData, InvitationCode } from '../types/auth';

export class AuthService {
  private static getFunctionsBasePath(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Missing Supabase configuration');
    }
    return `${supabaseUrl}/functions/v1/server/make-server-be81afe8`;
  }

  private static async callAdminFunction<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const session = await this.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error('You must be signed in to perform this action');
    }

    const url = `${this.getFunctionsBasePath()}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let payload: any = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (parseError) {
        logger.warn('Failed to parse admin function response', parseError instanceof Error ? parseError : new Error(String(parseError)));
      }
    }

    if (!response.ok) {
      const message = payload?.error ?? 'Admin request failed';
      throw new Error(message);
    }

    return payload as T;
  }

  /**
   * Sign in with email and password - simplified for performance
   */
  static async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        logger.error('Sign in failed', error);
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('No user data returned');
      }

      // Return basic user info - profile will be loaded separately if needed
      return {
        id: data.user.id,
        email: data.user.email!,
        profile: undefined // Don't fetch profile during sign-in for performance
      };
    } catch (error) {
      logger.error('Sign in error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Sign up with email, password and profile data
   */
  static async signUp(data: RegistrationData): Promise<void> {
    try {
      let isAutoApproved = false;

      // Check if using invitation code
      if (data.invitationCode) {
        const invitation = await this.validateInvitationCode(data.invitationCode);
        if (!invitation) {
          throw new Error('Invalid or expired invitation code');
        }
        
        // If invitation is specific to an email, verify it matches
        if (invitation.email && invitation.email.toLowerCase() !== data.email.toLowerCase()) {
          throw new Error('This invitation is for a different email address');
        }
        
        isAutoApproved = true;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email.toLowerCase().trim(),
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName
          }
        }
      });

      if (authError) {
        logger.error('Auth signup failed', authError);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: data.email.toLowerCase().trim(),
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'staff',
          is_approved: isAutoApproved,
          approved_at: isAutoApproved ? new Date().toISOString() : null
        });

      if (profileError) {
        logger.error('Profile creation failed', profileError);
        // Clean up auth user if profile creation failed
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error('Failed to create user profile');
      }

      // Mark invitation as used if applicable
      if (data.invitationCode && isAutoApproved) {
        await this.markInvitationAsUsed(data.invitationCode, authData.user.id);
      }

      logger.info('User registered successfully', { 
        userId: authData.user.id, 
        email: data.email,
        autoApproved: isAutoApproved 
      });

    } catch (error) {
      logger.error('Sign up error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Sign out failed', error);
        throw new Error(error.message);
      }
      logger.info('User signed out successfully');
    } catch (error) {
      logger.error('Sign out error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reset password for email
   */
  static async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        logger.error('Password reset failed', error);
        throw new Error(error.message);
      }

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Reset password error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get current session
   */
  static async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        logger.error('Get session failed', error);
        return null;
      }
      return session;
    } catch (error) {
      logger.error('Get session error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get user profile by ID
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('🔍 AuthService: Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('🔍 AuthService: Profile query result:', { data, error });

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found
          console.log('🔍 AuthService: No profile found (PGRST116)');
          return null;
        }
        console.error('🔍 AuthService: Profile fetch error:', error);
        logger.error('Failed to fetch user profile', error);
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
        isApproved: data.is_approved,
        approvedBy: data.approved_by,
        approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      logger.error('Get user profile error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...(updates.firstName && { first_name: updates.firstName }),
          ...(updates.lastName && { last_name: updates.lastName }),
          ...(updates.role && { role: updates.role }),
          ...(updates.isApproved !== undefined && { is_approved: updates.isApproved })
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Profile update failed', error);
        throw new Error(error.message);
      }

      return {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
        isApproved: data.is_approved,
        approvedBy: data.approved_by,
        approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      logger.error('Update profile error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Validate invitation code
   */
  private static async validateInvitationCode(code: string): Promise<InvitationCode | null> {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        code: data.code,
        email: data.email,
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
        usedBy: data.used_by,
        usedAt: data.used_at ? new Date(data.used_at) : undefined,
        isActive: data.is_active
      };
    } catch (error) {
      logger.error('Validate invitation code error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Mark invitation code as used
   */
  private static async markInvitationAsUsed(code: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('invitation_codes')
        .update({
          used_by: userId,
          used_at: new Date().toISOString(),
          is_active: false
        })
        .eq('code', code);

      if (error) {
        logger.error('Failed to mark invitation as used', error);
      }
    } catch (error) {
      logger.error('Mark invitation used error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Admin: Create invitation code
   */
  static async createInvitationCode(createdBy: string, email?: string, expiresInDays = 7): Promise<string> {
    try {
      const code = this.generateInvitationCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { error } = await supabase
        .from('invitation_codes')
        .insert({
          code,
          email: email?.toLowerCase().trim(),
          created_by: createdBy,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });

      if (error) {
        logger.error('Failed to create invitation code', error);
        throw new Error(error.message);
      }

      logger.info('Invitation code created', { code, email, createdBy });
      return code;
    } catch (error) {
      logger.error('Create invitation code error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Admin: Fetch invitation codes
   */
  static async getInvitationCodes(): Promise<InvitationCode[]> {
    try {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch invitation codes: ${error.message}`);
      }

      return (data || []).map((code) => ({
        id: code.id,
        code: code.code,
        email: code.email ?? undefined,
        createdBy: code.created_by,
        createdAt: new Date(code.created_at),
        expiresAt: new Date(code.expires_at),
        usedBy: code.used_by ?? undefined,
        usedAt: code.used_at ? new Date(code.used_at) : undefined,
        isActive: code.is_active,
      }));
    } catch (error) {
      logger.error('Get invitation codes error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Admin: Deactivate invitation code
   */
  static async deactivateInvitationCode(codeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('invitation_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) {
        throw new Error(`Failed to deactivate invitation code: ${error.message}`);
      }

      logger.info('Invitation code deactivated', { codeId });
    } catch (error) {
      logger.error('Deactivate invitation code error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate random invitation code
   */
  private static generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Admin: Get all pending users
   */
  static async getPendingUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch pending users', error);
        throw new Error(error.message);
      }

      return data.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isApproved: user.is_approved,
        approvedBy: user.approved_by,
        approvedAt: user.approved_at ? new Date(user.approved_at) : undefined,
        createdAt: new Date(user.created_at)
      }));
    } catch (error) {
      logger.error('Get pending users error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Admin: Approve user
   */
  static async approveUser(userId: string, approvedBy: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_approved: true,
          approved_by: approvedBy,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Failed to approve user', error);
        throw new Error(error.message);
      }

      logger.info('User approved', { userId, approvedBy });
    } catch (error) {
      logger.error('Approve user error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   */
  static async getAllUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get users: ${error.message}`);
      }

      return (data || []).map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isApproved: user.is_approved,
        approvedBy: user.approved_by,
        approvedAt: user.approved_at ? new Date(user.approved_at) : undefined,
        createdAt: new Date(user.created_at)
      }));
    } catch (error) {
      logger.error('Get all users error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reject a user's account (admin only)
   */
  static async rejectUser(userId: string): Promise<void> {
    try {
      await this.callAdminFunction<{ success: boolean }>('/admin/reject-user', { userId });
      logger.info('User rejected and auth removed', { userId });
    } catch (error) {
      logger.error('Reject user error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Admin: Update another user's profile fields
   */
  static async adminUpdateUser(
    userId: string,
    updates: Pick<Partial<UserProfile>, 'role' | 'isApproved'>,
  ): Promise<UserProfile> {
    try {
      const payload: Record<string, unknown> = {};

      if (updates.role) {
        payload.role = updates.role;
      }

      if (typeof updates.isApproved === 'boolean') {
        payload.isApproved = updates.isApproved;
      }

      if (Object.keys(payload).length === 0) {
        throw new Error('No admin updates provided');
      }

      const response = await this.callAdminFunction<{
        success: boolean;
        profile: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          role: 'admin' | 'staff';
          isApproved: boolean;
          approvedBy: string | null;
          approvedAt: string | null;
          createdAt: string;
        };
      }>('/admin/update-profile', {
        userId,
        updates: payload,
      });

      const updated = response.profile;

      return {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        isApproved: updated.isApproved,
        approvedBy: updated.approvedBy ?? undefined,
        approvedAt: updated.approvedAt ? new Date(updated.approvedAt) : undefined,
        createdAt: new Date(updated.createdAt),
      };
    } catch (error) {
      logger.error('Admin update user error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}