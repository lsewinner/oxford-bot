import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const loadTrends = createServerFn({method:'GET'})
  .inputValidator(v => z.object({force:z.boolean().optional()}).strict().parse(v ?? {}))
  .handler(async ({data}) => {
    const {getTrends} = await import('./trends.server');
    return getTrends(data.force);
  });