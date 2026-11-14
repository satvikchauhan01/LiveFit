import { Router } from 'express';

import { escapeHtml, page } from '../lib/pages';

// Share links work in any browser: they explain what the link is and offer to
// open it in the LiveFit app (via the livefit:// address the app registers).

export const communityPages = Router();

function openInApp(title: string, text: string, appLink: string) {
  return page(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p>${escapeHtml(text)}</p>
     <a href="${escapeHtml(appLink)}"><button type="button">Open in LiveFit</button></a>
     <p>Don’t have LiveFit yet? Install it, then open this link again.</p>`,
  );
}

communityPages.get('/u/:username', (req, res) => {
  const username = String(req.params.username).toLowerCase().replace(/[^a-z0-9_.]/g, '');
  res.send(
    openInApp(
      `@${username} on LiveFit`,
      'Follow them to see their runs, rides and workouts.',
      `livefit://community/user/${username}`,
    ),
  );
});

communityPages.get('/join/:type/:code', (req, res) => {
  const type = req.params.type === 'challenge' ? 'challenge' : 'club';
  const code = String(req.params.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  res.send(
    openInApp(
      type === 'club' ? 'Join a LiveFit club' : 'Join a LiveFit challenge',
      `Invite code: ${code}`,
      `livefit://community/join?type=${type}&code=${code}`,
    ),
  );
});
