import { router } from 'expo-router';

import type { ReportReason, ReportTarget } from '@shared/api';

export const REPORT_REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'spam', label: 'Spam' },
  { reason: 'harassment', label: 'Harassment or bullying' },
  { reason: 'inappropriate', label: 'Inappropriate content' },
  { reason: 'cheating', label: 'Fake or impossible activity' },
  { reason: 'other', label: 'Something else' },
];

/** Opens the report form for a person, workout, comment or club. */
export function reportContent(targetType: ReportTarget, targetId: string): void {
  router.push({ pathname: '/community/report', params: { type: targetType, id: targetId } });
}
