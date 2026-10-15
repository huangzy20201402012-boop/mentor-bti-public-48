import type { CharacterAssetSet, DimensionDefinition, Personality, ResearchDomainSet, ResultRuleSet, TestDefinition } from "@mentor-bti/bti-core";
import domainsJson from "../../../data/domains.json";
import dimensionsJson from "../../../data/dimensions.json";
import personalitiesJson from "../../../data/personalities.json";
import quickTestJson from "../../../data/quick-test.json";
import resultRulesJson from "../../../data/result-rules.json";
import { dimensionsFileSchema, domainsFileSchema, personalitiesFileSchema, resultRulesFileSchema, testDefinitionSchema } from "./schemas";
import { assertUnique, validateTestQuestions } from "./validate";

export interface QuickBtiContent {
  dimensions: DimensionDefinition[];
  domains: ResearchDomainSet;
  characterAssets: CharacterAssetSet;
  quickTest: TestDefinition;
  personalities: Personality[];
  resultRules: ResultRuleSet;
}

/** Load and validate the public 48-question content only. */
export function loadQuickContent(): QuickBtiContent {
  const dimensions = dimensionsFileSchema.parse(dimensionsJson);
  const domains = domainsFileSchema.parse(domainsJson);
  const quickTest = testDefinitionSchema.parse(quickTestJson);
  const personalities = personalitiesFileSchema.parse(personalitiesJson);
  const resultRules = resultRulesFileSchema.parse(resultRulesJson);
  // Illustrations are omitted until their publication rights are confirmed.
  const characterAssets: CharacterAssetSet = { version: "public-placeholder-v1", note: "CSS portraits", assets: [] };

  assertUnique(dimensions.dimensions.map((dimension) => dimension.id), "Dimension data");
  assertUnique(domains.domains.map((domain) => domain.code), "Domain data");
  assertUnique(quickTest.questions.map((question) => question.id), "Quick test data");
  assertUnique(personalities.personalities.map((personality) => personality.code), "Personality data");

  const knownDimensions = new Set(dimensions.dimensions.map((dimension) => dimension.id));
  validateTestQuestions(quickTest as TestDefinition, knownDimensions, "Quick test");

  return {
    dimensions: dimensions.dimensions as DimensionDefinition[],
    domains: domains as ResearchDomainSet,
    characterAssets,
    quickTest: quickTest as TestDefinition,
    personalities: personalities.personalities as Personality[],
    resultRules: resultRules as ResultRuleSet
  };
}
