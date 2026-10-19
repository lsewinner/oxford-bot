import { queryOptions } from '@tanstack/react-query';
import { readShare } from './shares.functions';
export const shareQuery = (token: string) => queryOptions({ queryKey: ['public-share', token], queryFn: () => readShare({ data: { token } }), staleTime: 0, gcTime: 0, retry: false });