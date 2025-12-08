import { ActionError, defineAction } from "astro:actions";
import type { ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  and,
  db,
  eq,
  or,
  PuzzleAttempts,
  PuzzleSessions,
  PuzzleTemplates,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createPuzzleTemplate: defineAction({
    input: z.object({
      name: z.string().min(1),
      puzzleType: z.string().min(1).optional(),
      difficulty: z.string().min(1).optional(),
      description: z.string().optional(),
      dataJson: z.string().optional(),
      solutionJson: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const id = crypto.randomUUID();
      await db.insert(PuzzleTemplates).values({
        id,
        userId: user.id,
        name: input.name,
        puzzleType: input.puzzleType,
        difficulty: input.difficulty,
        description: input.description,
        dataJson: input.dataJson,
        solutionJson: input.solutionJson,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        data: { id },
      };
    },
  }),

  updatePuzzleTemplate: defineAction({
    input: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      puzzleType: z.string().min(1).optional(),
      difficulty: z.string().min(1).optional(),
      description: z.string().optional(),
      dataJson: z.string().optional(),
      solutionJson: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(PuzzleTemplates)
        .where(eq(PuzzleTemplates.id, input.id));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Puzzle template not found.",
        });
      }

      if (existing.userId !== user.id || existing.isSystem) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You cannot modify this puzzle template.",
        });
      }

      const updates = {
        ...(input.name ? { name: input.name } : {}),
        ...(input.puzzleType ? { puzzleType: input.puzzleType } : {}),
        ...(input.difficulty ? { difficulty: input.difficulty } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.dataJson ? { dataJson: input.dataJson } : {}),
        ...(input.solutionJson ? { solutionJson: input.solutionJson } : {}),
        updatedAt: new Date(),
      } as const;

      await db
        .update(PuzzleTemplates)
        .set(updates)
        .where(eq(PuzzleTemplates.id, input.id));

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),

  listPuzzleTemplates: defineAction({
    input: z.object({
      includeSystem: z.boolean().default(true),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const conditions = [eq(PuzzleTemplates.userId, user.id)];
      if (input.includeSystem) {
        conditions.push(eq(PuzzleTemplates.isSystem, true));
      }

      const where = conditions.reduce((prev, current) =>
        prev ? or(prev, current) : current
      );

      const templates = await db
        .select()
        .from(PuzzleTemplates)
        .where(where);

      return {
        success: true,
        data: {
          items: templates,
          total: templates.length,
        },
      };
    },
  }),

  startPuzzleSession: defineAction({
    input: z.object({
      puzzleTemplateId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [template] = await db
        .select()
        .from(PuzzleTemplates)
        .where(
          and(
            eq(PuzzleTemplates.id, input.puzzleTemplateId),
            or(eq(PuzzleTemplates.userId, user.id), eq(PuzzleTemplates.isSystem, true))
          )
        );

      if (!template) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Puzzle template not found.",
        });
      }

      const id = crypto.randomUUID();
      const now = new Date();

      await db.insert(PuzzleSessions).values({
        id,
        puzzleTemplateId: template.id,
        userId: user.id,
        startedAt: now,
        status: "in-progress",
      });

      return {
        success: true,
        data: {
          id,
          puzzleTemplateId: template.id,
        },
      };
    },
  }),

  completePuzzleSession: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      status: z.enum(["completed", "abandoned"]).default("completed"),
      score: z.number().optional(),
      timeTakenSeconds: z.number().int().positive().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(PuzzleSessions)
        .where(
          and(
            eq(PuzzleSessions.id, input.sessionId),
            eq(PuzzleSessions.userId, user.id)
          )
        );

      if (!session) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Puzzle session not found.",
        });
      }

      await db
        .update(PuzzleSessions)
        .set({
          status: input.status,
          score: input.score,
          timeTakenSeconds: input.timeTakenSeconds,
          completedAt: new Date(),
        })
        .where(eq(PuzzleSessions.id, input.sessionId));

      return {
        success: true,
        data: { id: input.sessionId },
      };
    },
  }),

  recordPuzzleAttempt: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      attemptIndex: z.number().int().positive(),
      attemptDataJson: z.string().optional(),
      isCorrect: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(PuzzleSessions)
        .where(
          and(
            eq(PuzzleSessions.id, input.sessionId),
            eq(PuzzleSessions.userId, user.id)
          )
        );

      if (!session) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Puzzle session not found.",
        });
      }

      const id = crypto.randomUUID();

      await db.insert(PuzzleAttempts).values({
        id,
        sessionId: input.sessionId,
        attemptIndex: input.attemptIndex,
        attemptDataJson: input.attemptDataJson,
        isCorrect: input.isCorrect,
        createdAt: new Date(),
      });

      return {
        success: true,
        data: { id },
      };
    },
  }),

  listPuzzleSessions: defineAction({
    input: z.object({
      puzzleTemplateId: z.string().optional(),
      status: z.string().optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const filters = [eq(PuzzleSessions.userId, user.id)];
      if (input.puzzleTemplateId) {
        filters.push(eq(PuzzleSessions.puzzleTemplateId, input.puzzleTemplateId));
      }
      if (input.status) {
        filters.push(eq(PuzzleSessions.status, input.status));
      }

      const where = filters.reduce((prev, current) =>
        prev ? and(prev, current) : current
      );

      const offset = (input.page - 1) * input.pageSize;

      const sessions = await db
        .select()
        .from(PuzzleSessions)
        .where(where)
        .limit(input.pageSize)
        .offset(offset);

      return {
        success: true,
        data: {
          items: sessions,
          total: sessions.length,
          page: input.page,
        },
      };
    },
  }),
};
