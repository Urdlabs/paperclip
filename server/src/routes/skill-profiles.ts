import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createSkillProfileSchema, updateSkillProfileSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { skillProfileService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function skillProfileRoutes(db: Db) {
  const router = Router();
  const profiles = skillProfileService(db);

  // List all skill profiles for a company (builtin + custom)
  router.get("/companies/:companyId/skill-profiles", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const list = await profiles.list(companyId);
    res.json(list);
  });

  // Get a single skill profile
  router.get("/companies/:companyId/skill-profiles/:profileId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const profile = await profiles.getById(req.params.profileId as string);
    if (!profile || profile.companyId !== companyId) {
      res.status(404).json({ error: "Skill profile not found" });
      return;
    }
    res.json(profile);
  });

  // Create a custom skill profile
  router.post(
    "/companies/:companyId/skill-profiles",
    validate(createSkillProfileSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);

      const profile = await profiles.create(companyId, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "skill_profile.created",
        entityType: "skill_profile",
        entityId: profile.id,
        details: { name: profile.name, slug: profile.slug },
      });

      res.status(201).json(profile);
    },
  );

  // Update a skill profile (reject if builtin)
  router.patch(
    "/companies/:companyId/skill-profiles/:profileId",
    validate(updateSkillProfileSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);

      const existing = await profiles.getById(req.params.profileId as string);
      if (!existing || existing.companyId !== companyId) {
        res.status(404).json({ error: "Skill profile not found" });
        return;
      }
      if (existing.isBuiltin) {
        res.status(403).json({ error: "Cannot modify builtin skill profiles" });
        return;
      }

      const updated = await profiles.update(existing.id, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "skill_profile.updated",
        entityType: "skill_profile",
        entityId: existing.id,
        details: { name: updated?.name, slug: updated?.slug },
      });

      res.json(updated);
    },
  );

  // Delete a skill profile (reject if builtin)
  router.delete(
    "/companies/:companyId/skill-profiles/:profileId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);

      const existing = await profiles.getById(req.params.profileId as string);
      if (!existing || existing.companyId !== companyId) {
        res.status(404).json({ error: "Skill profile not found" });
        return;
      }
      if (existing.isBuiltin) {
        res.status(403).json({ error: "Cannot delete builtin skill profiles" });
        return;
      }

      await profiles.delete(existing.id);

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "skill_profile.deleted",
        entityType: "skill_profile",
        entityId: existing.id,
        details: { name: existing.name, slug: existing.slug },
      });

      res.json({ deleted: true });
    },
  );

  // Seed builtin profiles for a company (idempotent)
  router.post(
    "/companies/:companyId/skill-profiles/seed",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);

      const seeded = await profiles.seedBuiltinProfiles(companyId);
      res.json({ seeded: seeded.length, profiles: seeded });
    },
  );

  return router;
}
