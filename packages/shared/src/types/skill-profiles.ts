export interface SkillProfile {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  systemPromptAdditions: string;
  toolPreferences: Record<string, unknown> | null;
  outputFormatHints: string | null;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillProfileSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isBuiltin: boolean;
}
