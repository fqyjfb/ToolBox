import { logError } from '../services/loggerService';

export function handleError(error: unknown, context: string, message: string): void {
  logError(message, context, error as Error);
}
