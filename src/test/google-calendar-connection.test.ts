import { describe, expect, it } from 'vitest';
import { isWrite, validateOperation } from '@/lib/connections/catalog';

describe('Google Calendar connection', () => {
  it('only creating an event needs confirmation', () => {
    expect(isWrite('create_event')).toBe(true);
    expect(isWrite('events')).toBe(false);
    expect(isWrite('calendars')).toBe(false);
  });
  it('requires title, start and end to create an event', () => {
    expect(() => validateOperation('google_calendar', { operation: 'create_event', start: '2026-10-22T14:00:00+08:00', end: '2026-10-22T15:00:00+08:00' })).toThrow();
    expect(() => validateOperation('google_calendar', { operation: 'create_event', title: '评审', start: '2026-10-22T14:00:00+08:00' })).toThrow();
    expect(() => validateOperation('google_calendar', { operation: 'create_event', title: '评审', start: '2026-10-22T14:00:00+08:00', end: '2026-10-22T15:00:00+08:00' })).not.toThrow();
  });
  it('rejects an end before the start and mixed all-day/timed values', () => {
    expect(() => validateOperation('google_calendar', { operation: 'create_event', title: 'x', start: '2026-10-22T15:00:00+08:00', end: '2026-10-22T14:00:00+08:00' })).toThrow();
    expect(() => validateOperation('google_calendar', { operation: 'create_event', title: 'x', start: '2026-10-22', end: '2026-10-22T14:00:00+08:00' })).toThrow();
    expect(() => validateOperation('google_calendar', { operation: 'create_event', title: 'x', start: '2026-10-22', end: '2026-10-23' })).not.toThrow();
  });
  it('rejects unsupported operations', () => {
    expect(() => validateOperation('google_calendar', { operation: 'delete_event' })).toThrow();
  });
});

describe('Outlook Calendar connection', () => {
  it('only creating an event needs confirmation', () => {
    expect(isWrite('create_event')).toBe(true);
    expect(validateOperation('microsoft_calendar', { operation: 'events' })).not.toThrow();
    expect(validateOperation('microsoft_calendar', { operation: 'calendars' })).not.toThrow();
    expect(validateOperation('microsoft_calendar', { operation: 'create_event', title: '评审', start: '2026-10-22T14:00:00+08:00', end: '2026-10-22T15:00:00+08:00' })).not.toThrow();
    expect(() => validateOperation('microsoft_calendar', { operation: 'create_event', title: '评审', start: '2026-10-22T14:00:00+08:00' })).toThrow();
    expect(() => validateOperation('microsoft_calendar', { operation: 'create_event', title: 'x', start: '2026-10-22T15:00:00+08:00', end: '2026-10-22T14:00:00+08:00' })).toThrow();
    expect(() => validateOperation('microsoft_calendar', { operation: 'delete_event' })).toThrow();
  });
});
