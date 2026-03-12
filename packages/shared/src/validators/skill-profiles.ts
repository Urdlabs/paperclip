import { z } from "zod";

export const createSkillProfileSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50),
  description: z.string().optional(),
  systemPromptAdditions: z.string().min(1),
  toolPreferences: z.record(z.unknown()).optional(),
  outputFormatHints: z.string().optional(),
});

export type CreateSkillProfile = z.infer<typeof createSkillProfileSchema>;

export const updateSkillProfileSchema = createSkillProfileSchema.partial();

export type UpdateSkillProfile = z.infer<typeof updateSkillProfileSchema>;
