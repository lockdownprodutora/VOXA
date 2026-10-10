import { useCallback } from 'react';
import { UserActivityLogger, UserActivity } from '../utils/UserActivityLogger';

export function useUserActivityLogger(userId: string | undefined) {
  const logAction = useCallback(async (
    type: UserActivity['type'],
    description: string,
    details?: any
  ) => {
    if (!userId) return;
    await UserActivityLogger.log(userId, type, description, details);
  }, [userId]);

  return { logAction };
}
