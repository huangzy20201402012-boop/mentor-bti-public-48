export const AXIS_IDS = ["em", "dn", "sf", "co"] as const;
export type AxisId = (typeof AXIS_IDS)[number];

export const AXIS_ENDPOINTS = {
  em: { left: "E", right: "M" },
  dn: { left: "D", right: "N" },
  sf: { left: "S", right: "F" },
  co: { left: "C", right: "O" }
} as const;

export type AxisLetter = "E" | "M" | "D" | "N" | "S" | "F" | "C" | "O";
export type TestKind = "quick";
export type ResearchDomainCode = "ED" | "EN" | "MD" | "MN";
export type ContextTag = "baseline" | "pressure" | "timeline" | "quality";
export type QuestionKind = "scenario" | "bipolar" | "frequency" | "agreement" | "access" | "change";
export type QuestionScale = "A5" | "F5" | "R5" | "T5" | "C5" | "B5" | "S4";

export type DimensionId =
  | `type.${AxisId}`
  | "capital.research_power"
  | "capital.network_capital"
  | "capital.funding_platform"
  | "capital.project_level"
  | "access.network"
  | "access.funding_platform"
  | "access.opportunity"
  | "mentoring.communication"
  | "mentoring.expectation_alignment"
  | "mentoring.research_guidance"
  | "mentoring.independence_building"
  | "mentoring.career_development"
  | "experience.autonomy"
  | "experience.competence"
  | "experience.relatedness"
  | "experience.clarity"
  | "climate.emotional_regulation"
  | "climate.fairness_respect"
  | "climate.reliability"
  | "climate.openness_to_dissent"
  | "climate.boundary_awareness";

export type DimensionGroup = "type" | "capital" | "access" | "mentoring" | "experience" | "climate";

export interface ResearchDomain {
  code: ResearchDomainCode;
  name: string;
  subtitle: string;
  worldview: string;
  question: string;
  description: string;
  resourceStructure: string;
  researchRhythm: string;
  fitStudents: string;
  color: string;
  lightColor: string;
  darkColor: string;
}

export interface ResearchDomainSet {
  version: string;
  domains: ResearchDomain[];
}

export interface DimensionDefinition {
  id: DimensionId;
  group: DimensionGroup;
  label: string;
  shortLabel: string;
  description: string;
  axis?: AxisId;
  higherIsBetter?: boolean;
}

export interface QuestionOption {
  id: string;
  label: string;
  /** Normalized response coordinate. It must be in the inclusive range [-1, 1]. */
  value: number;
}

export interface DimensionContribution {
  dimensionId: DimensionId;
  weight: number;
  facet?: string;
}

export interface Question {
  id: string;
  test: TestKind;
  chapter?: number;
  kind: QuestionKind;
  scale?: QuestionScale;
  prompt: string;
  context: ContextTag[];
  options: QuestionOption[];
  naAllowed: boolean;
  reverse: boolean;
  contributions: DimensionContribution[];
}

export interface TestDefinition {
  version: string;
  test: TestKind;
  status: "active" | "planned";
  title: string;
  questionCount: number;
  questions: Question[];
}

export interface Personality {
  code: string;
  domain: ResearchDomainCode;
  name: string;
  englishName: string;
  archetype: string;
  axes: Record<AxisId, AxisLetter>;
  color: string;
  imageKey: string;
  headline: string;
  summary: string;
  tags: string[];
  strengths: string[];
  challenges: string[];
  bestFitStudents: string;
  quote: string;
}

export interface CharacterAsset {
  key: string;
  sourceFile: string;
  status: "sheet" | "single";
}

export interface CharacterAssetSet {
  version: string;
  note: string;
  assets: CharacterAsset[];
}

export type RuleComparator = "gte" | "lte";

export interface ResultRuleCondition {
  dimensionId: DimensionId;
  comparator: RuleComparator;
  value: number;
}

export interface ResultRule {
  id: string;
  product: TestKind;
  tag: string;
  conditions: ResultRuleCondition[];
}

export interface ResultRuleSet {
  version: string;
  rules: ResultRule[];
}

export type Answer = { optionId: string } | { optionId: "na" };

export interface TestSession {
  schemaVersion: 1;
  id: string;
  test: TestKind;
  contentVersion: string;
  status: "in_progress" | "completed";
  startedAt: string;
  updatedAt: string;
  currentQuestionId: string;
  answers: Record<string, Answer>;
  completedAt?: string;
  resultId?: string;
}

export interface SessionStorage {
  load(test: TestKind): TestSession | null;
  save(session: TestSession): void;
  clear(test: TestKind): void;
}

export interface DimensionScore {
  dimensionId: DimensionId;
  signedScore: number | null;
  score: number | null;
  coverage: number;
  consistency: number | null;
  answeredWeight: number;
  totalWeight: number;
}

export interface AxisScore {
  axis: AxisId;
  signedScore: number | null;
  left: { letter: AxisLetter; percent: number };
  right: { letter: AxisLetter; percent: number };
  selectedLetter: AxisLetter;
  isBoundary: boolean;
  coverage: number;
  consistency: number | null;
  confidence: number;
}

export interface ResponseQuality {
  coverage: number;
  consistency: number;
  differentiation: number;
  score: number;
  label: "high" | "normal" | "cautious" | "retry";
}

export interface QuickOverview {
  id: "research_resources" | "mentoring_investment" | "autonomy" | "interaction_comfort";
  label: string;
  score: number | null;
  coverage: number;
}

export interface QuickResult {
  test: "quick";
  contentVersion: string;
  typeCode: string;
  personality: Personality;
  axes: Record<AxisId, AxisScore>;
  typeConfidence: number;
  typeStability: "high" | "medium" | "boundary";
  dimensions: Record<DimensionId, DimensionScore>;
  overview: QuickOverview[];
  tags: string[];
  responseQuality: ResponseQuality;
}

export interface ShareCardAxis {
  code: AxisId;
  leftLetter: AxisLetter;
  rightLetter: AxisLetter;
  leftPercent: number;
  rightPercent: number;
}

/** A deliberately minimal, non-identifying payload for a result sharing card. */
export interface ShareCardPayload {
  version: 1;
  product: "quick";
  typeCode: string;
  typeName: string;
  domainCode: ResearchDomainCode;
  domainName: string;
  color: string;
  headline: string;
  imageKey: string;
  axes: ShareCardAxis[];
  brandLine: string;
}

/** Targets intentionally exclude personal identifiers and result data. */
export type SharePlatform = "system" | "wechat" | "qq-zone" | "douyin" | "xiaohongshu";

export interface SocialShareRequest {
  platform: SharePlatform;
  title: string;
  text: string;
  url: string;
  includesShareCard?: boolean;
}

export type SocialShareMethod = "native-sheet" | "web-url" | "copy-link";

export interface SocialShareTarget {
  platform: SharePlatform;
  label: string;
  method: SocialShareMethod;
  /** A direct URL is only supplied for platforms with a documented web share endpoint. */
  shareUrl?: string;
}

/**
 * Browser and provider adapters implement this boundary. Secrets, if a platform
 * requires them, remain server-side and must never be embedded in a share card.
 */
export interface SocialShareProvider {
  prepare(request: SocialShareRequest): Promise<SocialShareTarget>;
}
