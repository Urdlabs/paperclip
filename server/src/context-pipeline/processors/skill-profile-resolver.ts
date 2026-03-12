import type { PipelineContext } from "../types.js";

/**
 * Pipeline processor: augments promptTemplate with the agent's active skill profile.
 *
 * The skill profile is resolved by the heartbeat service and attached to the
 * PipelineContext before the pipeline runs. This processor reads it and injects
 * the profile's systemPromptAdditions into the prompt.
 *
 * Runs after task-type resolution but before serialization, so profile additions
 * are included in the serialized context.
 */
export function resolveSkillProfile(ctx: PipelineContext): PipelineContext {
  const profile = ctx.skillProfile;
  if (!profile) return ctx;

  let augmentedPrompt = `${ctx.promptTemplate}\n\n## Skill Profile: ${profile.name}\n${profile.systemPromptAdditions}`;

  if (profile.outputFormatHints) {
    augmentedPrompt += `\n\n### Output Format\n${profile.outputFormatHints}`;
  }

  return { ...ctx, promptTemplate: augmentedPrompt };
}
