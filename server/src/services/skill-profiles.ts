import { eq, and } from "drizzle-orm";
import { skillProfiles } from "@paperclipai/db/schema";
import type { Db } from "@paperclipai/db";
import type { CreateSkillProfile, UpdateSkillProfile } from "@paperclipai/shared";

/**
 * Six predefined skill profiles seeded per company.
 * Each shapes agent behavior via systemPromptAdditions, toolPreferences, and outputFormatHints.
 */
export const BUILTIN_SKILL_PROFILES: Array<{
  name: string;
  slug: string;
  description: string;
  systemPromptAdditions: string;
  toolPreferences: Record<string, unknown> | null;
  outputFormatHints: string | null;
  isBuiltin: true;
}> = [
  {
    name: "Refactor",
    slug: "refactor",
    description: "Focus on improving code quality, reducing complexity, and improving naming while maintaining existing behavior.",
    systemPromptAdditions:
      "You are a refactoring specialist. Focus on code quality: reduce complexity, improve naming conventions, and maintain existing behavior. " +
      "Prefer small, incremental changes over large rewrites. Each change should be independently verifiable. " +
      "Explain each change you make and why it improves the code. Look for code smells, duplication, and overly complex logic. " +
      "Never change observable behavior unless explicitly asked.",
    toolPreferences: null,
    outputFormatHints: "Explain each change with a before/after comparison. Group related changes together.",
    isBuiltin: true,
  },
  {
    name: "Test Writer",
    slug: "test-writer",
    description: "Write comprehensive tests covering edge cases, error paths, and boundary conditions.",
    systemPromptAdditions:
      "You are a testing specialist. Write comprehensive tests that cover edge cases, error paths, and boundary conditions. " +
      "Prefer unit tests over integration tests when possible. Use the existing test framework patterns in the project. " +
      "Each test should be independent and clearly named to describe the behavior being verified. " +
      "Aim for high coverage of critical paths. Include both positive and negative test cases.",
    toolPreferences: null,
    outputFormatHints: "Organize tests in describe blocks by feature. Use clear test names that describe expected behavior.",
    isBuiltin: true,
  },
  {
    name: "Reviewer",
    slug: "reviewer",
    description: "Analyze code for bugs, security issues, and performance problems with structured feedback.",
    systemPromptAdditions:
      "You are a code review specialist. Analyze code for bugs, security issues, performance problems, and maintainability concerns. " +
      "Produce structured feedback with severity levels (critical, suggestion, nitpick). Be constructive and specific. " +
      "Suggest concrete improvements rather than vague criticism. Consider edge cases, error handling, and potential race conditions. " +
      "Acknowledge good patterns when you see them.",
    toolPreferences: null,
    outputFormatHints: "Use severity levels: critical (must fix), suggestion (should consider), nitpick (optional improvement). Include line references.",
    isBuiltin: true,
  },
  {
    name: "Debugger",
    slug: "debugger",
    description: "Systematic bug diagnosis: reproduce, isolate, identify root cause, fix, and verify.",
    systemPromptAdditions:
      "You are a debugging specialist. Follow a systematic diagnosis process: reproduce the issue, isolate the problem, " +
      "identify the root cause, implement the fix, and verify the solution. Add regression tests for every bug you fix. " +
      "Explain the bug mechanism clearly so others can learn from it. Consider whether the same class of bug might exist elsewhere.",
    toolPreferences: null,
    outputFormatHints: "Structure your response as: 1) Reproduction steps, 2) Root cause analysis, 3) Fix description, 4) Verification, 5) Regression test.",
    isBuiltin: true,
  },
  {
    name: "Architect",
    slug: "architect",
    description: "Focus on system design, modularity, extensibility, and long-term maintenance.",
    systemPromptAdditions:
      "You are an architecture specialist. Focus on system design, modularity, and extensibility. " +
      "Consider long-term maintenance costs and scalability implications. Document architectural decisions and their tradeoffs. " +
      "Prefer composition over inheritance, clear interfaces over tight coupling. " +
      "Think about how changes affect the broader system, not just the immediate code.",
    toolPreferences: null,
    outputFormatHints: "Document decisions using ADR format: context, decision, consequences. Include diagrams when helpful.",
    isBuiltin: true,
  },
  {
    name: "Documentation Writer",
    slug: "documentation-writer",
    description: "Write clear, accurate documentation with examples matching existing project style.",
    systemPromptAdditions:
      "You are a documentation specialist. Write clear, accurate documentation that includes practical examples. " +
      "Match the existing documentation style in the project. Cover API contracts, usage patterns, and edge cases. " +
      "Keep documentation close to the code it describes. Use clear headings and organize content hierarchically. " +
      "Include code examples that can be copy-pasted and run.",
    toolPreferences: null,
    outputFormatHints: "Use markdown with clear headings. Include code examples for every public API. Document parameters, return values, and errors.",
    isBuiltin: true,
  },
];

/**
 * Skill profile service factory.
 */
export function skillProfileService(db: Db) {
  return {
    /**
     * List all skill profiles for a company (builtin + custom).
     */
    async list(companyId: string) {
      return db
        .select()
        .from(skillProfiles)
        .where(eq(skillProfiles.companyId, companyId))
        .orderBy(skillProfiles.name);
    },

    /**
     * Get a single skill profile by ID.
     */
    async getById(id: string) {
      const rows = await db
        .select()
        .from(skillProfiles)
        .where(eq(skillProfiles.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    /**
     * Get a skill profile by company + slug.
     */
    async getBySlug(companyId: string, slug: string) {
      const rows = await db
        .select()
        .from(skillProfiles)
        .where(
          and(
            eq(skillProfiles.companyId, companyId),
            eq(skillProfiles.slug, slug),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    /**
     * Create a custom skill profile.
     */
    async create(companyId: string, data: CreateSkillProfile) {
      const rows = await db
        .insert(skillProfiles)
        .values({
          companyId,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          systemPromptAdditions: data.systemPromptAdditions,
          toolPreferences: data.toolPreferences ?? null,
          outputFormatHints: data.outputFormatHints ?? null,
          isBuiltin: false,
        })
        .returning();
      return rows[0]!;
    },

    /**
     * Update a skill profile (only non-builtin).
     */
    async update(id: string, data: UpdateSkillProfile) {
      const rows = await db
        .update(skillProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(skillProfiles.id, id))
        .returning();
      return rows[0] ?? null;
    },

    /**
     * Delete a skill profile (only non-builtin).
     */
    async delete(id: string) {
      const rows = await db
        .delete(skillProfiles)
        .where(eq(skillProfiles.id, id))
        .returning();
      return rows[0] ?? null;
    },

    /**
     * Seed builtin profiles for a company. Idempotent (upsert on companyId+slug).
     */
    async seedBuiltinProfiles(companyId: string) {
      const results = [];
      for (const profile of BUILTIN_SKILL_PROFILES) {
        const rows = await db
          .insert(skillProfiles)
          .values({
            companyId,
            name: profile.name,
            slug: profile.slug,
            description: profile.description,
            systemPromptAdditions: profile.systemPromptAdditions,
            toolPreferences: profile.toolPreferences,
            outputFormatHints: profile.outputFormatHints,
            isBuiltin: true,
          })
          .onConflictDoNothing({
            target: [skillProfiles.companyId, skillProfiles.slug],
          })
          .returning();
        if (rows[0]) results.push(rows[0]);
      }
      return results;
    },
  };
}
