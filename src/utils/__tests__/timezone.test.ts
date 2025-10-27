import { describe, it, expect } from 'vitest';
import {
  toESTDateString,
  formatDateEST,
  formatDateTimeEST,
  logDateToUTCNoon,
} from '@/utils/timezone';

describe('timezone utils (EST)', () => {
  it('toESTDateString returns YYYY-MM-DD in EST', () => {
    // Jan 1, 2024 05:00 UTC is still Dec 31, 2023 in EST
    const d = new Date('2024-01-01T05:00:00Z');
    const s = toESTDateString(d);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatDateEST returns MM/DD/YYYY', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    const s = formatDateEST(d);
    expect(s).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('formatDateTimeEST returns a string with date and time', () => {
    const d = new Date('2024-06-15T12:34:00Z');
    const s = formatDateTimeEST(d);
    expect(s).toMatch(/\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}/);
  });

  it('logDateToUTCNoon anchors to UTC noon for stability', () => {
    const d = logDateToUTCNoon('2024-08-20');
    expect(d.toISOString()).toBe('2024-08-20T12:00:00.000Z');
  });
});
