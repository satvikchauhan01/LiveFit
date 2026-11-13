import { Redirect } from 'expo-router';

// The Record tab opens the /record modal instead of this screen (see the tab
// layout). If this route is ever opened directly, send it there too.
export default function StartTab() {
  return <Redirect href="/record" />;
}
