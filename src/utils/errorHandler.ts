import { logError } from '../services/loggerService';

export function handleError(error: unknown, context: string, message: string): void {
  logError(message, context, error as Error);
}

export async function catchAndLog<T>(
  fn: () => Promise<T>,
  context: string,
  message: string,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(message, context, error as Error);
    return fallback;
  }
}

export async function catchAndLogVoid(
  fn: () => Promise<void>,
  context: string,
  message: string
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logError(message, context, error as Error);
  }
}