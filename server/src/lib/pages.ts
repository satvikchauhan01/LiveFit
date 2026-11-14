// Tiny server-rendered web pages: links in emails open these in a browser, and
// Google Play requires an account-deletion page that works without the app.

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wraps page content in LiveFit's dark style. `body` must already be safe HTML. */
export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · LiveFit</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0B0D0E; color: #F4F6F5; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 440px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-size: 28px; margin: 0 0 16px; }
  p { color: #9AA3A0; }
  label { display: block; margin: 16px 0 6px; font-weight: 600; }
  input { box-sizing: border-box; width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #2A2F33; background: #16191B; color: inherit; font: inherit; }
  button { margin-top: 24px; width: 100%; padding: 14px; border: 0; border-radius: 999px; background: #C6FF3D; color: #0B0D0E; font: inherit; font-weight: 700; cursor: pointer; }
  button.danger { background: #FF5A5F; color: #0B0D0E; }
  .error { color: #FF5A5F; }
  .ok { color: #3DDC97; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}
