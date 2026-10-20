import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Minimal react-hook-form resolver for zod schemas.
 * Error messages are i18n keys produced by @kartup/domain schemas.
 */
export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(schema: S): Resolver<z.input<S>, unknown, z.output<S>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<z.input<S>> };
  };
}
