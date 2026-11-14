import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

// Crash reporting with Sentry. It is off unless a DSN (the address of your
// Sentry project) is provided at build time in EXPO_PUBLIC_SENTRY_DSN, and it
// never runs in development builds, where errors show on screen anyway.

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const crashReportingEnabled = Boolean(dsn) && !__DEV__;

export function startCrashReporting(): void {
  if (!crashReportingEnabled) {
    return;
  }
  Sentry.init({
    dsn,
    // No IP address or other personal details.
    sendDefaultPii: false,
    // Errors and crash-free-session numbers only; no performance tracing.
    tracesSampleRate: 0,
    // Console messages could contain workout details, so they aren't sent with reports.
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
  });
}

/** Wraps the root component so render errors are reported too. */
export function withCrashReporting<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return crashReportingEnabled ? Sentry.wrap(Component) : Component;
}
