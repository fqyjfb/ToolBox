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

export async function safeTry<T>(
  fn: () => Promise<T>
): Promise<{ result: T | null; error: Error | null }> {
  try {
    const result = await fn();
    return { result, error: null };
  } catch (error) {
    return { 
      result: null, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay);
    }
    throw error;
  }
}

export function ignoreError<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}