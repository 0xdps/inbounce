import { randomBytes } from 'crypto';

/**
 * Slug generation and validation for Inbounce apps.
 * 
 * Format: <sanitized-name>-<6-hex-chars>
 * Example: newsletter-app-a1b2c3
 * 
 * Rules:
 * - Immutable, read-only, generated once on app creation
 * - Unique enforced by database constraint
 * - Max 40 characters
 * - Pattern: ^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{6}$
 */

/**
 * Regex pattern for slug validation
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{6}$/;
const MAX_SLUG_LENGTH = 40;

/**
 * Generate a random slug based on app name
 * 
 * @param appName - App name to base slug on (e.g., "My Newsletter App")
 * @returns Generated slug (e.g., "my-newsletter-app-a1b2c3")
 */
export function generateSlug(appName: string): string {
  // Sanitize: lowercase, trim, replace non-alphanumeric with dash
  const base = appName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Convert to lowercase, replace non-alphanum with dash
    .replace(/^-|-$/g, '') // Strip leading/trailing dashes
    .slice(0, 30); // Max 30 chars for base to leave room for suffix

  // 3 bytes = 6 hex chars = 16.7M combinations (collision probability very low)
  const suffix = randomBytes(3).toString('hex');

  return `${base}-${suffix}`;
}

/**
 * Validate slug format
 * 
 * @param slug - Slug to validate
 * @returns true if valid, false otherwise
 */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= MAX_SLUG_LENGTH;
}

/**
 * Generate a unique slug by retrying until a non-existent slug is found
 * 
 * @param appName - App name
 * @param checkExists - Async function to check if slug exists (returns boolean)
 * @param maxRetries - Maximum retry attempts (default 10)
 * @returns Unique slug
 * @throws Error if unable to generate unique slug after max retries
 */
export async function createUniqueSlug(
  appName: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxRetries: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateSlug(appName);

    const exists = await checkExists(candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error(
    `Failed to generate unique slug after ${maxRetries} retries. ` +
    `App name may be too generic. Try a more specific name.`
  );
}

/**
 * Get table name for schema fields table
 * 
 * @param slug - App slug
 * @returns Table name (e.g., "sef_newsletter-app-a1b2c3")
 */
export function getSchemaFieldsTableName(slug: string): string {
  return `sef_${slug}`;
}

/**
 * Get table name for submissions table
 * 
 * @param slug - App slug
 * @returns Table name (e.g., "sub_newsletter-app-a1b2c3")
 */
export function getSubmissionsTableName(slug: string): string {
  return `sub_${slug}`;
}
