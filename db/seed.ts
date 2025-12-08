import { db, PuzzleTemplates } from "astro:db";

// https://astro.build/db/seed
export default async function seed() {
  const now = new Date();

  await db.insert(PuzzleTemplates).values({
    id: "system-puzzle-sample",
    userId: null,
    name: "Starter Puzzle",
    puzzleType: "logic-grid",
    difficulty: "easy",
    description: "A sample puzzle included with the starter app.",
    dataJson: JSON.stringify({ prompt: "Match the pets to their owners." }),
    solutionJson: JSON.stringify({ answer: "sample-solution" }),
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  });
}
