import nodemailer from 'nodemailer';

import { env } from '../env';

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

export type Email = { to: string; subject: string; text: string };

/**
 * Sends an email through the SMTP server in SMTP_URL. Without one (local
 * development), the email is printed to the console instead, links included.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (!transport) {
    console.log(`\n--- Email to ${email.to}: ${email.subject} ---\n${email.text}\n---\n`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...email });
}
