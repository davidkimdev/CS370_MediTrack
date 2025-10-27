// Timezone utilities for consistent EST (America/New_York) handling
// - Storage: Supabase stores timestamps in UTC; for date-only fields (log_date),
//   we store the calendar date as seen in EST.
// - Display: The web app should show dates in EST regardless of user locale.

const EST_TZ = 'America/New_York'

function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime())
}

/**
 * Format a Date to an EST calendar date string (YYYY-MM-DD) for storage (e.g., log_date)
 */
export function toESTDateString(date: Date): string {
  // en-CA yields YYYY-MM-DD
  const d = isValidDate(date) ? date : new Date()
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Format a Date for display as MM/DD/YYYY in EST
 */
export function formatDateEST(date: Date): string {
  if (!isValidDate(date)) return '-'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Format a Date for display with time in EST (e.g., MM/DD/YYYY, HH:MM)
 */
export function formatDateTimeEST(date: Date): string {
  if (!isValidDate(date)) return '-'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * For a date-only string (YYYY-MM-DD) representing an EST calendar day,
 * return a Date anchored at 12:00:00Z to ensure stable conversion back to EST
 * without day shifts across viewer locales.
 */
export function logDateToUTCNoon(logDate: string): Date {
  // Using noon UTC avoids DST/day shifts when formatting to EST
  if (!logDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(logDate)) {
    // Fallback to now if invalid
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0))
  }
  return new Date(`${logDate}T12:00:00Z`)
}
