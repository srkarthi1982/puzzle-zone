/**
 * Puzzle Zone - play engaging puzzles.
 *
 * Design goals:
 * - Support a catalog of puzzle templates (types, difficulty).
 * - Track play sessions and attempts for scoring and progress.
 * - Flexible enough for many puzzle types (word, logic, number).
 */

import { defineTable, column, NOW } from "astro:db";

export const PuzzleTemplates = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    // system-level puzzles may be built-in
    userId: column.text({ optional: true }),           // null => global puzzle
    name: column.text(),                               // "Sudoku #1", "Word Search - Animals"
    puzzleType: column.text({ optional: true }),       // "sudoku", "word-search", "riddle", etc.
    difficulty: column.text({ optional: true }),       // "easy", "medium", "hard"
    description: column.text({ optional: true }),
    dataJson: column.text({ optional: true }),         // puzzle configuration/state as JSON
    solutionJson: column.text({ optional: true }),     // solution config as JSON
    isSystem: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const PuzzleSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    puzzleTemplateId: column.text({
      references: () => PuzzleTemplates.columns.id,
    }),
    userId: column.text(),
    startedAt: column.date({ default: NOW }),
    completedAt: column.date({ optional: true }),
    status: column.text({ optional: true }),           // "in-progress", "completed", "abandoned"
    score: column.number({ optional: true }),
    timeTakenSeconds: column.number({ optional: true }),
  },
});

export const PuzzleAttempts = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => PuzzleSessions.columns.id,
    }),
    attemptIndex: column.number(),                     // 1, 2, 3...
    attemptDataJson: column.text({ optional: true }),  // user's move/guess as JSON
    isCorrect: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  PuzzleTemplates,
  PuzzleSessions,
  PuzzleAttempts,
} as const;
