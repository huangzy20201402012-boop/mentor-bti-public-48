import type { TestDefinition } from "@mentor-bti/bti-core";

export function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate identifiers.`);
  }
}

export function validateTestQuestions(definition: TestDefinition, knownDimensions: ReadonlySet<string>, label: string): void {
  if (definition.status === "active" && definition.questionCount !== definition.questions.length) {
    throw new Error(`${label} questionCount does not match its question data.`);
  }
  if (definition.status === "active" && definition.questions.length === 0) {
    throw new Error(`${label} must contain at least one question when active.`);
  }

  assertUnique(definition.questions.map((question) => question.id), `${label} data`);
  for (const question of definition.questions) {
    const totalWeight = question.contributions.reduce((sum, contribution) => sum + contribution.weight, 0);
    if (definition.test === "quick" && totalWeight !== 0 && Math.abs(totalWeight - 1) > 0.000001) {
      throw new Error(`${question.id} contributions must sum to 1.`);
    }
    if (totalWeight > 1.000001) {
      throw new Error(`${question.id} contributions cannot exceed a total weight of 1.`);
    }
    for (const contribution of question.contributions) {
      if (!knownDimensions.has(contribution.dimensionId)) {
        throw new Error(`${question.id} references an undefined dimension: ${contribution.dimensionId}.`);
      }
    }
  }
}
