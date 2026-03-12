import { api } from "./client";

export interface SkillProfile {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  systemPromptOverride: string | null;
  toolAllowlist: string[] | null;
  toolDenylist: string[] | null;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export const skillProfilesApi = {
  list: (companyId: string) =>
    api.get<SkillProfile[]>(`/companies/${companyId}/skill-profiles`),

  create: (companyId: string, data: { name: string; description?: string; systemPromptOverride?: string; toolAllowlist?: string[]; toolDenylist?: string[] }) =>
    api.post<SkillProfile>(`/companies/${companyId}/skill-profiles`, data),

  update: (companyId: string, profileId: string, data: Partial<{ name: string; description: string; systemPromptOverride: string; toolAllowlist: string[]; toolDenylist: string[] }>) =>
    api.patch<SkillProfile>(`/companies/${companyId}/skill-profiles/${profileId}`, data),

  remove: (companyId: string, profileId: string) =>
    api.delete<{ deleted: boolean }>(`/companies/${companyId}/skill-profiles/${profileId}`),

  seed: (companyId: string) =>
    api.post<{ seeded: number; profiles: SkillProfile[] }>(`/companies/${companyId}/skill-profiles/seed`, {}),
};
