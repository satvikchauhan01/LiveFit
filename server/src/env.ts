import { z } from 'zod';

// Every setting the server reads from its environment, checked once at startup
// so a missing value fails loudly instead of halfway through a request.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** postgres://user:password@host:5432/database */
  DATABASE_URL: z.string().min(1),
  /** Signs access tokens. At least 32 random characters; never share or commit it. */
  JWT_SECRET: z.string().min(32),
  /**
   * The server's public address, used in links inside emails and share links
   * (https://api.example.com). On Render it defaults to the service's own address.
   */
  APP_URL: z.url(),
  /** smtps://user:password@smtp.example.com:465. Without it, emails are printed to the console. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('LiveFit <no-reply@localhost>'),
  /** Claude API key for the AI coach (Release 4). The coach is off without it. */
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Monthly spending cap for the AI coach, in US dollars, across all users. */
  COACH_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(20),
  /** Google Play service-account JSON (one line), for checking LiveFit Pro purchases. */
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Shared secret in the Google Play notifications push URL (?secret=…). */
  GOOGLE_PLAY_RTDN_SECRET: z.string().optional(),
  /** The app's Android package name, for checking purchases. */
  ANDROID_PACKAGE_NAME: z.string().default('com.livefit.app'),
  /** Comma-separated emails that get moderator access to the admin endpoints. */
  ADMIN_EMAILS: z.string().default(''),
});

const parsed = schema.safeParse({
  ...process.env,
  // On Render the public address is provided, so APP_URL can be left unset there.
  APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL,
});
if (!parsed.success) {
  console.error('Invalid server settings:\n', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const adminEmails = new Set(
  env.ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
