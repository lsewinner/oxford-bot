export const SQUARE_CATEGORIES = ['productivity', 'coding', 'writing', 'lifestyle'] as const;
export type SquareCategory = (typeof SQUARE_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<SquareCategory, string> = {
  productivity: '工作提效', coding: '编程开发', writing: '写作与邮件', lifestyle: '生活创意',
};
export type SubmissionStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Only paid members may submit a Bot for review; free users keep private links. */
export function canSubmitToSquare(isPro: boolean): boolean { return isPro; }

export type SquareBot = { token: string; name: string; kind: string; breed: string | null; intro: string; category: string; creatorName: string; official: boolean };

export function filterSquareBots(bots: SquareBot[], category: string, query: string): SquareBot[] {
  const q = query.trim().toLowerCase();
  return bots.filter((b) => (category === 'all' || b.category === category)
    && (!q || b.name.toLowerCase().includes(q) || b.intro.toLowerCase().includes(q)));
}
