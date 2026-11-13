import { describe, expect, it } from '@jest/globals';

import { startOfWeek } from './dates';

describe('startOfWeek', () => {
  // Dates are built in local time, so these pass in any time zone.
  const monday = new Date(2026, 10, 9);

  it('goes back to Monday midnight', () => {
    expect(startOfWeek(new Date(2026, 10, 13, 15, 30))).toEqual(monday); // Friday afternoon
    expect(startOfWeek(new Date(2026, 10, 15, 23, 59))).toEqual(monday); // Sunday night
  });

  it('keeps Monday itself', () => {
    expect(startOfWeek(new Date(2026, 10, 9, 0, 0))).toEqual(monday);
  });
});
