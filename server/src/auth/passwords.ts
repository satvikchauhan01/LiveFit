import { hash, verify } from '@node-rs/argon2';

// Argon2id: a password hash that is deliberately slow and memory-hungry, so a
// stolen database can't be cracked quickly. The settings are stored inside each
// hash, so they can be raised later without breaking existing passwords.

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function checkPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
