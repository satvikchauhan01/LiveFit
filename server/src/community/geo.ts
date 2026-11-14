// Small geometry helpers for routes on the server.

export type LatLng = [number, number];

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Drops the first and last `metres` of a route (so it doesn't start at your door). */
export function trimEnds(route: LatLng[], metres: number): LatLng[] {
  if (route.length < 2) return [];
  let start = 0;
  for (let covered = 0; start < route.length - 1 && covered < metres; start += 1) {
    covered += distanceM(route[start], route[start + 1]);
  }
  let end = route.length - 1;
  for (let covered = 0; end > start && covered < metres; end -= 1) {
    covered += distanceM(route[end - 1], route[end]);
  }
  return end > start ? route.slice(start, end + 1) : [];
}

/**
 * Douglas–Peucker simplification: keeps the points that matter to the shape and
 * drops the ones that sit on a nearly straight line, so a route of thousands of
 * fixes becomes a few hundred without looking any different on a phone screen.
 */
export function simplify(route: LatLng[], toleranceM = 5): LatLng[] {
  if (route.length <= 2) return route;
  const keep = new Array<boolean>(route.length).fill(false);
  keep[0] = true;
  keep[route.length - 1] = true;
  const stack: [number, number][] = [[0, route.length - 1]];

  // Distance from a point to the line through a and b, in a local flat projection.
  const offset = (p: LatLng, a: LatLng, b: LatLng) => {
    const scale = Math.cos(toRadians(a[0]));
    const ax = a[1] * scale;
    const bx = b[1] * scale;
    const px = p[1] * scale;
    const dx = bx - ax;
    const dy = b[0] - a[0];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (p[0] - a[0]) * dy) / lengthSquared));
    const closest: LatLng = [a[0] + t * dy, (ax + t * dx) / scale];
    return distanceM(p, closest);
  };

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let worst = -1;
    let worstDistance = 0;
    for (let i = first + 1; i < last; i += 1) {
      const d = offset(route[i], route[first], route[last]);
      if (d > worstDistance) {
        worstDistance = d;
        worst = i;
      }
    }
    if (worst >= 0 && worstDistance > toleranceM) {
      keep[worst] = true;
      stack.push([first, worst], [worst, last]);
    }
  }
  return route.filter((_, i) => keep[i]);
}
