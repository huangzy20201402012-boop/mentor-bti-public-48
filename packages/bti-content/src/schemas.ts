import { z } from "zod";

const axisIdSchema = z.enum(["em", "dn", "sf", "co"]);
const dimensionIdSchema = z.string().regex(/^(type\.(em|dn|sf|co)|(capital|access|mentoring|experience|climate)\.[a-z_]+)$/);

export const dimensionSchema = z.object({
  id: dimensionIdSchema,
  group: z.enum(["type", "capital", "access", "mentoring", "experience", "climate"]),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  description: z.string().min(1),
  axis: axisIdSchema.optional(),
  higherIsBetter: z.boolean().optional()
});

export const dimensionsFileSchema = z.object({
  version: z.string().min(1),
  dimensions: z.array(dimensionSchema).min(4)
});

export const domainsFileSchema = z.object({
  version: z.string().min(1),
  domains: z.array(z.object({
    code: z.enum(["ED", "EN", "MD", "MN"]),
    name: z.string().min(1),
    subtitle: z.string().min(1),
    worldview: z.string().min(1),
    question: z.string().min(1),
    description: z.string().min(1),
    resourceStructure: z.string().min(1),
    researchRhythm: z.string().min(1),
    fitStudents: z.string().min(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    lightColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    darkColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  })).length(4)
});

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number().min(-1).max(1)
});

const contributionSchema = z.object({
  dimensionId: dimensionIdSchema,
  weight: z.number().positive().max(1),
  facet: z.string().min(1).optional()
});

export const questionSchema = z.object({
  id: z.string().regex(/^Q\d{3}$/),
  test: z.literal("quick"),
  kind: z.enum(["scenario", "bipolar", "frequency", "agreement", "access", "change"]),
  prompt: z.string().min(1),
  context: z.array(z.enum(["baseline", "pressure", "timeline", "quality"])).min(1),
  options: z.array(optionSchema).min(2),
  naAllowed: z.boolean(),
  reverse: z.boolean(),
  contributions: z.array(contributionSchema).max(3)
});

export const testDefinitionSchema = z.object({
  version: z.string().min(1),
  test: z.literal("quick"),
  status: z.literal("active"),
  title: z.string().min(1),
  questionCount: z.literal(48),
  questions: z.array(questionSchema).length(48)
});

export const personalitySchema = z.object({
  code: z.string().regex(/^[EM][DN][SF][CO]$/),
  domain: z.enum(["ED", "EN", "MD", "MN"]),
  name: z.string().min(1),
  englishName: z.string().min(1),
  archetype: z.string().min(1),
  axes: z.object({ em: z.enum(["E", "M"]), dn: z.enum(["D", "N"]), sf: z.enum(["S", "F"]), co: z.enum(["C", "O"]) }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  imageKey: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(3).max(5),
  strengths: z.array(z.string().min(1)).min(3),
  challenges: z.array(z.string().min(1)).min(3),
  bestFitStudents: z.string().min(1),
  quote: z.string().min(1)
});

export const personalitiesFileSchema = z.object({
  version: z.string().min(1),
  personalities: z.array(personalitySchema).length(16)
});

export const resultRulesFileSchema = z.object({
  version: z.string().min(1),
  rules: z.array(z.object({
    id: z.string().min(1),
    product: z.literal("quick"),
    tag: z.string().min(1),
    conditions: z.array(z.object({
      dimensionId: dimensionIdSchema,
      comparator: z.enum(["gte", "lte"]),
      value: z.number().min(0).max(100)
    })).min(1)
  }))
});
