import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';

/**
 * Utility functions for managing invitation codes
 */
export class InvitationManager {
  /**
   * Generate a random invitation code
   */
  static generateCode(prefix: string = '', length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomPart = Array.from(
      { length: length - prefix.length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    
    return (prefix + randomPart).toUpperCase().slice(0, length);
  }

  /**
   * Create a new invitation code
   */
  static async createInvitation(
    createdBy: string,
    options: {
      email?: string;
      expiresInDays?: number;
      customCode?: string;
    } = {}
  ): Promise<string> {
    try {
      const code = options.customCode || this.generateCode('', 8);
      
      const invitationCode = await AuthService.createInvitationCode(
        createdBy,
        options.email,
        options.expiresInDays || 7
      );
      
      logger.info('Invitation code created', { 
        code: invitationCode, 
        email: options.email,
        expiresInDays: options.expiresInDays 
      });
      
      return invitationCode;
    } catch (error) {
      logger.error('Failed to create invitation code', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate multiple invitation codes at once
   */
  static async createBulkInvitations(
    createdBy: string,
    count: number,
    options: {
      prefix?: string;
      expiresInDays?: number;
    } = {}
  ): Promise<string[]> {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const code = await this.createInvitation(createdBy, {
          customCode: this.generateCode(options.prefix || '', 8),
          expiresInDays: options.expiresInDays
        });
        codes.push(code);
      } catch (error) {
        logger.error(`Failed to create invitation code ${i + 1}/${count}`, error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return codes;
  }

  /**
   * Common invitation code presets
   */
  static readonly PRESETS = {
    STAFF: {
      prefix: 'STAFF',
      expiresInDays: 30
    },
    ADMIN: {
      prefix: 'ADMIN',
      expiresInDays: 7
    },
    TEMP: {
      prefix: 'TEMP',
      expiresInDays: 3
    },
    CLINIC: {
      prefix: 'CLINIC',
      expiresInDays: 60
    }
  };
}