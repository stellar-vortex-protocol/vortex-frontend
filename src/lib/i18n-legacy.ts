import { messages } from "./messages";
import { secureLogger } from "./secureLogging";

type NestedKeyOf<T> =
  T extends Record<string, infer V>
    ? V extends Record<string, unknown>
      ? `${string & keyof T}.${string & keyof V}`
      : string & keyof T
    : never;

/**
 * Get a message from the catalog using dot notation
 * @param key - Dot-notation key like "footer.copyright"
 * @returns The message string
 */
export function getMessage(key: NestedKeyOf<typeof messages>): string {
  const parts = key.split(".");
  let value: any = messages;

  for (const part of parts) {
    value = value[part];
    if (value === undefined) {
      secureLogger.warn(`Message key not found: ${key}`);
      return key;
    }
  }

  return value as string;
}
