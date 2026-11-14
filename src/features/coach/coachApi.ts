import type {
  CoachLogResult,
  CoachStatus,
  CoachTextResult,
  CoachTrainingSummary,
} from '@shared/api';

import { api } from '@/features/account/apiClient';

export const coachApi = {
  status: () => api<CoachStatus>('/v1/coach/status'),
  ask: (question: string, summary: CoachTrainingSummary) =>
    api<CoachTextResult>('/v1/coach/ask', { method: 'POST', body: { question, summary } }),
  log: (text: string, weightUnit: 'kg' | 'lb', exercises: { id: string; name: string }[]) =>
    api<CoachLogResult>('/v1/coach/log', {
      method: 'POST',
      body: { text, weightUnit, exercises },
    }),
};
