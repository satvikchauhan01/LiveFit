/**
 * The live tracking page. `name` must already be HTML-escaped; `token` is only
 * used inside a URL and is checked to be URL-safe first.
 */
export function livePage(name: string, token: string): string {
  const safeToken = token.replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${name} · Live on LiveFit</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #0B0D0E; color: #F4F6F5; font: 16px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0 0 120px 0; }
  #panel { position: absolute; left: 0; right: 0; bottom: 0; height: 120px; box-sizing: border-box;
    padding: 16px; background: #16191B; border-top: 1px solid #2A2F33; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  p { margin: 0; color: #9AA3A0; }
  .live { color: #C6FF3D; font-weight: 700; }
  .ended { color: #FFB547; font-weight: 700; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>${name}</h1>
  <p id="status">Loading…</p>
  <p id="stats"></p>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  var words = { run: 'run', walk: 'walk', cycle: 'ride', hike: 'hike', wheelchair: 'push' };
  var map = L.map('map', { zoomControl: true }).setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var line = L.polyline([], { color: '#C6FF3D', weight: 5 }).addTo(map);
  var dot = null;
  var fitted = false;

  function ago(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    return Math.round(m / 60) + ' h ago';
  }
  function duration(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + ' h ' + m + ' min' : m + ' min';
  }

  function load() {
    fetch('/live/${safeToken}/data', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('gone'); return r.json(); })
      .then(function (d) {
        var status = document.getElementById('status');
        var word = words[d.activity] || 'workout';
        if (d.ended) {
          status.innerHTML = '<span class="ended">Finished</span> · this ' + word + ' has ended';
        } else if (d.lastAt) {
          status.innerHTML = '<span class="live">● Live</span> · on a ' + word + ' · updated ' + ago(d.lastAt);
        } else {
          status.textContent = 'Waiting for the first position…';
        }
        var parts = [];
        if (d.distanceM) parts.push((d.distanceM / 1000).toFixed(2) + ' km');
        parts.push(duration((d.lastAt || Date.now()) - d.startedAt));
        document.getElementById('stats').textContent = parts.join(' · ');
        if (d.trail && d.trail.length) line.setLatLngs(d.trail);
        if (d.position) {
          if (!dot) {
            dot = L.circleMarker(d.position, { radius: 9, color: '#0B0D0E', weight: 3, fillColor: '#C6FF3D', fillOpacity: 1 }).addTo(map);
          } else {
            dot.setLatLng(d.position);
          }
          if (!fitted) { map.setView(d.position, 15); fitted = true; } else { map.panTo(d.position); }
        }
        if (!d.ended) setTimeout(load, 15000);
      })
      .catch(function () {
        document.getElementById('status').textContent = 'This live link has ended.';
      });
  }
  load();
})();
</script>
</body>
</html>`;
}
