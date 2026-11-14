import { createHash, randomBytes } from 'node:crypto';

/** A long random string for links and refresh tokens (256 bits, URL-safe). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are stored only as SHA-256 hashes: if the database leaked, the stored
 * values couldn't be used to sign in. (Passwords use Argon2 instead, which is
 * deliberately slow; random tokens are already unguessable, so a fast hash is fine.)
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
