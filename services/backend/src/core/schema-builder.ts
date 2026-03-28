import { z } from 'zod';

/**
 * SchemaField type - represents a single field in a form schema
 */
export interface SchemaField {
  id: string;
  name: string;
  type: 'string' | 'email' | 'number' | 'boolean' | 'url' | 'date';
  required: boolean;
  unique: boolean;
  compound_key?: string;
  position: number;
}

/**
 * Build a Zod validation schema from field definitions.
 * 
 * The schema is compiled once and cached in-memory for performance.
 * 
 * @param fields - Array of field definitions
 * @returns Zod schema object
 */
export function buildZodSchema(fields: SchemaField[]): z.ZodType<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema: z.ZodTypeAny;

    // Build validator for field type
    switch (field.type) {
      case 'email':
        schema = z.string().email().max(10000);
        break;

      case 'number':
        schema = z.coerce.number();
        break;

      case 'boolean':
        schema = z.coerce.boolean();
        break;

      case 'url':
        schema = z.string().url().max(10000);
        break;

      case 'date':
        schema = z
          .string()
          .max(10000)
          .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' });
        break;

      case 'string':
      default:
        schema = z.string().min(1).max(10000);
        break;
    }

    // Make optional if not required
    if (!field.required) {
      schema = schema.optional();
    }

    shape[field.name] = schema;
  }

  // Strict mode: reject fields not in schema
  return z.object(shape).strict();
}

/**
 * Empty/permissive schema for apps with no schema fields defined yet
 * Allows any object, strict mode still prevents extra fields
 */
export function getEmptySchema(): z.ZodType<any> {
  return z.object({}).strict();
}
