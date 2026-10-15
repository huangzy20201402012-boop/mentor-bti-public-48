import { AXIS_ENDPOINTS, AXIS_IDS } from "@mentor-bti/bti-core";
import type {
  Answer,
  AxisId,
  AxisLetter,
  AxisScore,
  DimensionDefinition,
  DimensionId,
  DimensionScore,
  Personality,
  QuickOverview,
  QuickResult,
  Question,
  ResponseQuality,
  ResultRuleSet,
  ShareCardPayload,
  TestDefinition
} from "@mentor-bti/bti-core";

interface Observation {
  value: number;
  weight: number;
}

export interface QuickScoringInput {
  definition: TestDefinition;
  dimensions: readonly DimensionDefinition[];
  personalities: readonly Personality[];
  resultRules: ResultRuleSet;
  answers: Readonly<Record<string, Answer | undefined>>;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function optionValue(question: Question, answer: Answer | undefined): number | null {
  if (!answer || answer.optionId === "na") {
    return null;
  }
  const option = question.options.find((candidate) => candidate.id === answer.optionId);
  if (!option) {
    throw new Error(`Unknown option '${answer.optionId}' for ${question.id}.`);
  }
  return question.reverse ? -option.value : option.value;
}

function calculateConsistency(observations: readonly Observation[]): number | null {
  if (observations.length === 0) {
    return null;
  }
  if (observations.length === 1) {
    return 1;
  }
  const totalWeight = observations.reduce((sum, observation) => sum + observation.weight, 0);
  const mean = observations.reduce((sum, observation) => sum + observation.value * observation.weight, 0) / totalWeight;
  const meanAbsoluteDeviation = observations.reduce(
    (sum, observation) => sum + Math.abs(observation.value - mean) * observation.weight,
    0
  ) / totalWeight;
  return round(clamp(1 - meanAbsoluteDeviation, 0, 1), 4);
}

function calculateDimensionScore(dimensionId: DimensionId, questions: readonly Question[], answers: QuickScoringInput["answers"]): DimensionScore {
  const observations: Observation[] = [];
  let totalWeight = 0;

  for (const question of questions) {
    const contributions = question.contributions.filter((contribution) => contribution.dimensionId === dimensionId);
    for (const contribution of contributions) {
      totalWeight += contribution.weight;
      const value = optionValue(question, answers[question.id]);
      if (value !== null) {
        observations.push({ value, weight: contribution.weight });
      }
    }
  }

  const answeredWeight = observations.reduce((sum, observation) => sum + observation.weight, 0);
  const signedScore = answeredWeight === 0
    ? null
    : round(observations.reduce((sum, observation) => sum + observation.value * observation.weight, 0) / answeredWeight, 4);

  return {
    dimensionId,
    signedScore,
    score: signedScore === null ? null : round((signedScore + 1) * 50),
    coverage: totalWeight === 0 ? 0 : round(answeredWeight / totalWeight, 4),
    consistency: calculateConsistency(observations),
    answeredWeight: round(answeredWeight, 4),
    totalWeight: round(totalWeight, 4)
  };
}

function scoreAxis(axis: AxisId, score: DimensionScore): AxisScore {
  const endpoints = AXIS_ENDPOINTS[axis];
  const signed = score.signedScore;
  const leftPercent = signed === null ? 50 : round((1 - signed) * 50);
  const rightPercent = signed === null ? 50 : round((1 + signed) * 50);
  const selectedLetter = (signed === null || signed <= 0 ? endpoints.left : endpoints.right) as AxisLetter;
  const strength = signed === null ? 0 : Math.abs(signed);
  const confidence = round(strength * (score.consistency ?? 0) * score.coverage * 100);

  return {
    axis,
    signedScore: signed,
    left: { letter: endpoints.left as AxisLetter, percent: leftPercent },
    right: { letter: endpoints.right as AxisLetter, percent: rightPercent },
    selectedLetter,
    isBoundary: signed === null || Math.abs(signed) <= 0.1,
    coverage: score.coverage,
    consistency: score.consistency,
    confidence
  };
}

function aggregateOverview(id: QuickOverview["id"], label: string, dimensionIds: readonly DimensionId[], scores: Record<DimensionId, DimensionScore>): QuickOverview {
  const applicable = dimensionIds.map((dimensionId) => scores[dimensionId]).filter((score) => score.score !== null);
  const answeredWeight = applicable.reduce((sum, score) => sum + score.answeredWeight, 0);
  const totalWeight = dimensionIds.reduce((sum, dimensionId) => sum + scores[dimensionId].totalWeight, 0);
  const score = answeredWeight === 0
    ? null
    : round(applicable.reduce((sum, dimension) => sum + (dimension.score ?? 0) * dimension.answeredWeight, 0) / answeredWeight);
  return { id, label, score, coverage: totalWeight === 0 ? 0 : round(answeredWeight / totalWeight, 4) };
}

const QUALITY_CHECK_PAIRS = [
  ["Q047", "Q045"], // alternative proposals ↔ openness to dissent
  ["Q048", "Q042"] // changed tasks ↔ clarity of priorities
] as const;

function pairedConsistency(questionsById: ReadonlyMap<string, Question>, answers: QuickScoringInput["answers"]): number[] {
  const scores: number[] = [];
  for (const [qualityCheckId, relatedQuestionId] of QUALITY_CHECK_PAIRS) {
    const qualityQuestion = questionsById.get(qualityCheckId);
    const relatedQuestion = questionsById.get(relatedQuestionId);
    if (!qualityQuestion || !relatedQuestion) continue;
    const qualityValue = optionValue(qualityQuestion, answers[qualityCheckId]);
    const relatedValue = optionValue(relatedQuestion, answers[relatedQuestionId]);
    if (qualityValue === null || relatedValue === null) continue;
    // Both values are normalised to -1…1, so a two-point gap is fully inconsistent.
    scores.push(round(clamp(1 - Math.abs(qualityValue - relatedValue) / 2, 0, 1), 4));
  }
  return scores;
}

function responseQuality(questions: readonly Question[], answers: QuickScoringInput["answers"], axes: Record<AxisId, AxisScore>): ResponseQuality {
  const values = questions.map((question) => optionValue(question, answers[question.id])).filter((value): value is number => value !== null);
  const coverage = questions.length === 0 ? 0 : values.length / questions.length;
  const consistencies = [
    ...AXIS_IDS.map((axis) => axes[axis].consistency).filter((value): value is number => value !== null),
    ...pairedConsistency(new Map(questions.map((question) => [question.id, question])), answers)
  ];
  const consistency = consistencies.length === 0 ? 0 : consistencies.reduce((sum, value) => sum + value, 0) / consistencies.length;
  const differentiation = values.length === 0 ? 0 : 1 - values.filter((value) => Math.abs(value) < 0.000001).length / values.length;
  const score = round((0.45 * consistency + 0.35 * coverage + 0.2 * differentiation) * 100);
  const label = score >= 80 ? "high" : score >= 65 ? "normal" : score >= 50 ? "cautious" : "retry";
  return { coverage: round(coverage, 4), consistency: round(consistency, 4), differentiation: round(differentiation, 4), score, label };
}

function matchesRule(score: DimensionScore | undefined, comparator: "gte" | "lte", value: number): boolean {
  if (!score || score.score === null) {
    return false;
  }
  return comparator === "gte" ? score.score >= value : score.score <= value;
}

/**
 * Scores the 48-question product without accessing browser or React APIs.
 * The tie rule is deliberate: score 0 chooses the left endpoint and is marked boundary.
 */
export function scoreQuickTest(input: QuickScoringInput): QuickResult {
  if (input.definition.test !== "quick" || input.definition.status !== "active") {
    throw new Error("scoreQuickTest requires an active quick-test definition.");
  }

  const scores = {} as Record<DimensionId, DimensionScore>;
  for (const dimension of input.dimensions) {
    scores[dimension.id] = calculateDimensionScore(dimension.id, input.definition.questions, input.answers);
  }

  const axes = {} as Record<AxisId, AxisScore>;
  for (const axis of AXIS_IDS) {
    axes[axis] = scoreAxis(axis, scores[`type.${axis}`]);
  }
  const typeCode = AXIS_IDS.map((axis) => axes[axis].selectedLetter).join("");
  const personality = input.personalities.find((candidate) => candidate.code === typeCode);
  if (!personality) {
    throw new Error(`No personality content found for generated type ${typeCode}.`);
  }

  const typeConfidence = round(AXIS_IDS.reduce((sum, axis) => sum + axes[axis].confidence, 0) / AXIS_IDS.length);
  const typeStability = AXIS_IDS.some((axis) => axes[axis].isBoundary)
    ? "boundary"
    : typeConfidence >= 70
      ? "high"
      : "medium";
  const ruleTags = input.resultRules.rules
    .filter((rule) => rule.product === "quick" && rule.conditions.every((condition) => matchesRule(scores[condition.dimensionId], condition.comparator, condition.value)))
    .map((rule) => rule.tag);
  const tags = [...new Set([...personality.tags, ...ruleTags])].slice(0, 5);

  return {
    test: "quick",
    contentVersion: input.definition.version,
    typeCode,
    personality,
    axes,
    typeConfidence,
    typeStability,
    dimensions: scores,
    overview: [
      aggregateOverview("research_resources", "科研资源", ["capital.research_power", "capital.network_capital", "capital.funding_platform", "capital.project_level", "access.network", "access.funding_platform", "access.opportunity"], scores),
      aggregateOverview("mentoring_investment", "培养投入", ["mentoring.communication", "mentoring.expectation_alignment", "mentoring.research_guidance", "mentoring.independence_building", "mentoring.career_development"], scores),
      aggregateOverview("autonomy", "自主程度", ["experience.autonomy"], scores),
      aggregateOverview("interaction_comfort", "互动舒适度", ["experience.relatedness", "climate.emotional_regulation", "climate.fairness_respect", "climate.reliability", "climate.openness_to_dissent", "climate.boundary_awareness"], scores)
    ],
    tags,
    responseQuality: responseQuality(input.definition.questions, input.answers, axes),
  };
}

export function createQuickShareCardPayload(result: QuickResult, domainName: string): ShareCardPayload {
  return {
    version: 1,
    product: "quick",
    typeCode: result.typeCode,
    typeName: result.personality.name,
    domainCode: result.personality.domain,
    domainName,
    color: result.personality.color,
    headline: result.personality.headline,
    imageKey: result.personality.imageKey,
    axes: AXIS_IDS.map((axis) => ({
      code: axis,
      leftLetter: result.axes[axis].left.letter,
      rightLetter: result.axes[axis].right.letter,
      leftPercent: result.axes[axis].left.percent,
      rightPercent: result.axes[axis].right.percent
    })),
    brandLine: "不是给导师排名，而是看清你身处怎样的科研生态。"
  };
}
