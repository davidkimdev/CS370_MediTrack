import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const validateEmail = (email: string) => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) {
    throw new Error('Please provide a valid email address.');
  }
};

export class ProfileService {
  private static async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      logger.error('Failed to fetch current user', error);
      throw new Error(error.message || 'Unable to fetch authenticated user');
    }

    if (!data.user) {
      throw new Error('No authenticated user found');
    }

    return data.user;
  }

  private static async reauthenticate(password: string) {
    const user = await this.getCurrentUser();
    if (!user.email) {
      throw new Error('Primary email address is unavailable.');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      logger.warn('Password reauthentication failed', error);
      throw new Error('Password verification failed. Please check your password and try again.');
    }
  }

  static async addSecondaryEmail(email: string, password: string): Promise<string[]> {
    validateEmail(email);
    const normalized = normalizeEmail(email);

    await this.reauthenticate(password);

    const user = await this.getCurrentUser();
    const existing = Array.isArray(user.user_metadata?.secondary_emails)
      ? (user.user_metadata?.secondary_emails as string[])
      : [];

    if (existing.length >= 1) {
      throw new Error('Only one backup email can be linked at a time.');
    }

    if (existing.includes(normalized) || user.email?.toLowerCase() === normalized) {
      throw new Error('This email is already associated with your account.');
    }

    const updated = [...existing, normalized];

    const { data, error } = await supabase.auth.updateUser({
      data: { secondary_emails: updated },
    });

    if (error) {
      logger.error('Failed to add secondary email', error);
      throw new Error(error.message || 'Unable to add secondary email');
    }

    return Array.isArray(data.user?.user_metadata?.secondary_emails)
      ? (data.user?.user_metadata?.secondary_emails as string[])
      : updated;
  }

  static async removeSecondaryEmail(email: string, password: string): Promise<string[]> {
    const normalized = normalizeEmail(email);
    await this.reauthenticate(password);

    const user = await this.getCurrentUser();
    const existing = Array.isArray(user.user_metadata?.secondary_emails)
      ? (user.user_metadata?.secondary_emails as string[])
      : [];

    if (!existing.includes(normalized)) {
      throw new Error('That email is not linked to your account.');
    }

    if (existing.length === 0) {
      throw new Error('No backup emails are linked to this account.');
    }

    const updated = existing.filter((item) => item !== normalized);

    const { data, error } = await supabase.auth.updateUser({
      data: { secondary_emails: updated },
    });

    if (error) {
      logger.error('Failed to remove secondary email', error);
      throw new Error(error.message || 'Unable to remove secondary email');
    }

    return Array.isArray(data.user?.user_metadata?.secondary_emails)
      ? (data.user?.user_metadata?.secondary_emails as string[])
      : updated;
  }

  static async replacePrimaryEmail(newEmail: string, password: string): Promise<string> {
    validateEmail(newEmail);
    const normalized = normalizeEmail(newEmail);

    await this.reauthenticate(password);

    const { data, error } = await supabase.auth.updateUser({
      email: normalized,
    });

    if (error) {
      logger.error('Failed to update primary email', error);
      throw new Error(error.message || 'Unable to update primary email');
    }

    // Supabase requires email confirmation; until then, old email remains active.
    return data.user?.email ?? normalized;
  }
}
