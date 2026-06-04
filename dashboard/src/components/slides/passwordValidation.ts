const CORRECT_PASSWORD = 'anastasia';

export function validatePassword(value: string): boolean {
  return value === CORRECT_PASSWORD;
}
