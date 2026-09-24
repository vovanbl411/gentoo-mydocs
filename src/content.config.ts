import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				kind: z
					.enum(['guide', 'reference', 'troubleshooting', 'incident', 'system', 'policy'])
					.optional(),
				scope: z.enum(['general', 'system', 'mixed', 'repository']).optional(),
				status: z.enum(['draft', 'current', 'deprecated', 'historical']).optional(),
				last_verified: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.optional(),
				verified_on: z.array(z.string()).optional(),
			}),
		}),
	}),
};
