import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import type { ApiErrorBody } from '../../../shared/api';

/** An error that becomes a JSON response with this status and code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'bad_request') =>
  new HttpError(400, code, message);
export const unauthorized = (message = 'Please sign in again.', code = 'unauthorized') =>
  new HttpError(401, code, message);
export const forbidden = (message = 'You can’t do that.', code = 'forbidden') =>
  new HttpError(403, code, message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);

/** Checks a request body (or query) against a schema; a mismatch is a 400 with the first problem. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    throw badRequest(`${where}${issue?.message ?? 'Invalid request.'}`, 'invalid_request');
  }
  return result.data;
}

/** The last middleware: turns thrown errors into the JSON error shape the app expects. */
export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message },
    } satisfies ApiErrorBody);
    return;
  }
  console.error(error);
  res.status(500).json({
    error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' },
  } satisfies ApiErrorBody);
}
