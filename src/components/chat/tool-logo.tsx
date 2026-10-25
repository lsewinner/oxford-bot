import { siAirtable, siAsana, siClickup, siCloudflare, siDiscord, siGitee, siGithub, siGmail, siGooglecalendar, siGoogledrive, siJira, siLinear, siNotion, siSupabase, siTelegram, siX } from 'simple-icons';

type Icon = { path: string; hex: string };
const BRAND: Record<string, Icon> = {
  google_mail: siGmail, google_calendar: siGooglecalendar, google_drive: siGoogledrive, notion: siNotion,
  github: siGithub, cloudflare: siCloudflare, supabase: siSupabase, gitee: siGitee, linear: siLinear,
  airtable: siAirtable, clickup: siClickup, asana: siAsana, jira: siJira, telegram: siTelegram, discord: siDiscord, x: siX,
};
// Brands without a bundled vector logo use a brand-colored monogram tile.
const MONO: Record<string, { text: string; hex: string }> = {
  microsoft_outlook: { text: 'O', hex: '0078D4' }, microsoft_calendar: { text: 'O', hex: '0078D4' },
  microsoft_teams: { text: 'T', hex: '5059C9' }, slack: { text: 'S', hex: '4A154B' },
  yuque: { text: '雀', hex: '00B96B' }, oanda: { text: 'O', hex: 'E8701A' },
};

export function ToolLogo({ id, name }: { id: string; name: string }) {
  const icon = BRAND[id];
  if (icon) return <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground"><svg viewBox="0 0 24 24" className="size-5" fill={`#${icon.hex}`}><path d={icon.path} /></svg></span>;
  const m = MONO[id] ?? { text: name.slice(0, 1), hex: '666666' };
  return <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-primary-foreground" style={{ backgroundColor: `#${m.hex}`, color: '#fff' }}>{m.text}</span>;
}
