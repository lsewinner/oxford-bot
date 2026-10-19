// Resolves the server-side secret used to encrypt connection credentials and sign OAuth state.
// Falls back through existing project secrets so a missing dedicated variable never blocks connecting.
const CHAINS = {
  connection: ['APP_USER_CONNECTION_KEY_SECRET', 'PERSONAL_TOKEN_ENCRYPTION_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'],
  personal_token: ['PERSONAL_TOKEN_ENCRYPTION_SECRET', 'APP_USER_CONNECTION_KEY_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'],
} as const;

export function resolveConnectionSecret(purpose: keyof typeof CHAINS = 'connection'): string {
  for (const name of CHAINS[purpose]) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw;
  }
  // Only reachable when the server has no secrets at all; never encrypt with a guessable key.
  throw new Error('服务器密钥缺失，请稍后重试');
}
