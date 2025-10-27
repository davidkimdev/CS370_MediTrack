/**
 * Centralized logging service for MediTrack
 * Provides different log levels and handles development vs production environments
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 100;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.NODE_ENV === 'development';
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
      error,
    };

    // Add to history (useful for debugging)
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Format the log message
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${level.toUpperCase()}] ${timestamp}`;

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.log(`${prefix} ${message}`, data ? data : '');
        }
        break;
      case 'info':
        console.info(`${prefix} ${message}`, data ? data : '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data ? data : '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, error || data || '');
        // In production, you might want to send to an error tracking service
        // Example: Sentry, LogRocket, etc.
        break;
    }
  }

  /**
   * Debug level - only shows in development environment
   * Use for detailed debugging information
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Info level - general information
   * Use for normal application flow information
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Warning level - something unexpected but not critical
   * Use for recoverable errors or deprecated usage
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Error level - actual errors that need attention
   * Use for exceptions, failed operations, etc.
   */
  error(message: string, error?: Error | any): void {
    this.log('error', message, undefined, error instanceof Error ? error : undefined);
  }

  /**
   * Get recent log history (useful for debugging)
   */
  getHistory(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logHistory.filter(entry => entry.level === level);
    }
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }
}

// Create and export a singleton instance
export const logger = new Logger();

// Export the class for testing purposes
export { Logger };
export type { LogLevel, LogEntry };