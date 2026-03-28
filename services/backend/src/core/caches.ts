import { z } from 'zod';
import { SchemaField, buildZodSchema, getEmptySchema } from './schema-builder.js';

/**
 * In-memory caches for high-performance lookups
 * 
 * Both follow the same invalidation pattern:
 * - On-demand building (lazy loading)
 * - Hourly reset (safety net for stale data)
 * - Event-driven invalidation on data changes
 * - Empty on server restart
 */

// ============================================================================
// Schema Cache (Zod Validators)
// ============================================================================

export interface CachedSchema {
  slug: string;
  zod: z.ZodType<any>;
  fields: SchemaField[];
  builtAt: number;
}

const schemaCache = new Map<string, CachedSchema>();

/**
 * Get compiled Zod schema from cache or build on-demand
 *
 * @param slug - App slug
 * @param fetchFields - Async function to fetch fields from DB
 * @returns Zod schema (cached or freshly built)
 */
export async function getZodSchema(
  slug: string,
  fetchFields: (slug: string) => Promise<SchemaField[]>
): Promise<z.ZodType<any>> {
  // Check cache first
  const cached = schemaCache.get(slug);
  if (cached) {
    return cached.zod;
  }

  // Cache miss: fetch fields from DB
  const fields = await fetchFields(slug);

  // Build schema (empty if no fields)
  const zod = fields.length > 0 ? buildZodSchema(fields) : getEmptySchema();

  // Store in cache
  schemaCache.set(slug, {
    slug,
    zod,
    fields,
    builtAt: Date.now(),
  });

  return zod;
}

/**
 * Invalidate schema cache for a specific app (e.g., after schema update)
 */
export function invalidateSchemaCacheForApp(slug: string): void {
  schemaCache.delete(slug);
}

// ============================================================================
// App Metadata Cache
// ============================================================================

export interface CachedAppMetadata {
  id: string; // Internal UUID
  slug: string;
  name: string;
  allowed_origins: string[]; // Pre-parsed array
  api_key: string;
  created_at: number;
  cachedAt: number;
}

const appMetadataCache = new Map<string, CachedAppMetadata>();

/**
 * Get app metadata from cache or build on-demand
 *
 * @param slug - App slug
 * @param fetchApp - Async function to fetch app from DB
 * @returns App metadata (cached or freshly fetched)
 */
export async function getAppMetadata(
  slug: string,
  fetchApp: (slug: string) => Promise<any | null>
): Promise<CachedAppMetadata | null> {
  // Check cache first
  const cached = appMetadataCache.get(slug);
  if (cached) {
    return cached;
  }

  // Cache miss: fetch from DB
  const app = await fetchApp(slug);
  if (!app) return null;

  // Build metadata
  const metadata: CachedAppMetadata = {
    id: app.id,
    slug: app.slug,
    name: app.name,
    allowed_origins: JSON.parse(app.allowed_origins || '[]'),
    api_key: app.api_key,
    created_at: app.created_at,
    cachedAt: Date.now(),
  };

  // Store in cache
  appMetadataCache.set(slug, metadata);

  return metadata;
}

/**
 * Invalidate app metadata cache for a specific app (e.g., after app update)
 */
export function invalidateAppMetadataCacheForApp(slug: string): void {
  appMetadataCache.delete(slug);
}

// ============================================================================
// Hourly Reset Timer
// ============================================================================

/**
 * Initialize hourly cache reset
 * Call this once on server startup
 */
export function initializeCacheResetTimer(logger?: any): void {
  setInterval(() => {
    const schemaCacheSize = schemaCache.size;
    const metadataCacheSize = appMetadataCache.size;

    schemaCache.clear();
    appMetadataCache.clear();

    if (logger) {
      logger.info(
        { schemaCacheSize, metadataCacheSize },
        'Caches cleared (hourly reset)'
      );
    }
  }, 60 * 60 * 1000); // 1 hour
}

// ============================================================================
// Cache Statistics (for debugging)
// ============================================================================

export interface CacheStats {
  schemaCache: {
    size: number;
    entries: Array<{ slug: string; builtAt: number }>;
  };
  appMetadataCache: {
    size: number;
    entries: Array<{ slug: string; cachedAt: number }>;
  };
}

/**
 * Get current cache statistics
 */
export function getCacheStats(): CacheStats {
  return {
    schemaCache: {
      size: schemaCache.size,
      entries: Array.from(schemaCache.entries()).map(([slug, { builtAt }]) => ({
        slug,
        builtAt,
      })),
    },
    appMetadataCache: {
      size: appMetadataCache.size,
      entries: Array.from(appMetadataCache.entries()).map(([slug, { cachedAt }]) => ({
        slug,
        cachedAt,
      })),
    },
  };
}
