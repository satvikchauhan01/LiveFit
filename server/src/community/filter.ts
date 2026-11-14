import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
} from 'obscenity';

import { badRequest } from '../lib/http';

// A content filter for usernames, club names and comments. It uses the
// "obscenity" library's English word list, which also catches common tricks
// like l33t-speak and extra spaces.

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}

/** Throws a friendly 400 if the text isn't allowed. */
export function assertClean(text: string, what: string): void {
  if (containsProfanity(text)) {
    throw badRequest(`Please choose a different ${what}.`, 'content_not_allowed');
  }
}

const USERNAME = /^[a-z0-9_.]{3,20}$/;

/** 3–20 lower-case letters, digits, dots or underscores, and nothing rude. */
export function normaliseUsername(raw: string): string {
  const username = raw.trim().toLowerCase();
  if (!USERNAME.test(username)) {
    throw badRequest(
      'Usernames are 3–20 characters: letters, numbers, dots and underscores.',
      'invalid_username',
    );
  }
  assertClean(username, 'username');
  return username;
}
