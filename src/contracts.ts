import { z } from "zod";

export const SKIPPED_ANSWER = "[Skipped]";

export const QaItemSchema = z.object({
  question: z.string().trim().min(1).max(600),
  answer: z.string().trim().min(1).max(5_000),
  phaseLabel: z.string().trim().min(1).max(80),
  isWorry: z.boolean(),
});

export const InterviewRequestSchema = z.object({
  answers: z.array(QaItemSchema).max(12),
});

export const InterviewReplySchema = z
  .object({
    urgent: z.boolean(),
    urgentReason: z.string().trim().max(500),
    done: z.boolean(),
    phaseLabel: z.string().trim().max(80),
    question: z.string().trim().max(600),
  })
  .superRefine((value, context) => {
    if (value.urgent && !value.urgentReason) {
      context.addIssue({ code: "custom", path: ["urgentReason"], message: "An urgent flag needs a reason." });
    }
    if (!value.urgent && !value.done && !value.question) {
      context.addIssue({ code: "custom", path: ["question"], message: "A continuing interview needs one question." });
    }
  });

const ShortText = z.string().trim().max(800);
const BulletList = z.array(z.string().trim().min(1).max(500)).max(8);

export const BriefDraftSchema = z.object({
  topOfMind: ShortText,
  mainConcern: z.string().trim().min(1).max(800),
  timeline: BulletList,
  symptoms: BulletList,
  impact: ShortText,
  whatChanged: ShortText,
  triedAlready: BulletList,
  medications: ShortText,
  questionsForDoctor: z.array(z.string().trim().min(1).max(500)).max(6),
  inTheirWords: z.array(z.string().trim().min(1).max(500)).max(4),
});

export const BriefSchema = BriefDraftSchema.extend({
  quoteWarning: z.boolean(),
});

export const ProviderConfigSchema = z.object({
  provider: z.enum(["mock", "anthropic"]),
  sendsDataToExternalProvider: z.boolean(),
});

export type QaItem = z.infer<typeof QaItemSchema>;
export type InterviewReply = z.infer<typeof InterviewReplySchema>;
export type BriefDraft = z.infer<typeof BriefDraftSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

function normaliseForComparison(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-GB");
}

export function quoteAppearsInTranscript(quote: string, answers: QaItem[]): boolean {
  const candidate = normaliseForComparison(quote);
  return candidate.length > 0 && answers.some((item) => {
    if (item.answer === SKIPPED_ANSWER) return false;
    return normaliseForComparison(item.answer).includes(candidate);
  });
}

function expectedWorry(answers: QaItem[]): string {
  const worry = [...answers].reverse().find((item) => item.isWorry);
  return worry && worry.answer !== SKIPPED_ANSWER ? worry.answer : "";
}

export function verifyBriefGrounding(value: unknown, answers: QaItem[]): string[] {
  const parsed = BriefSchema.safeParse(value);
  if (!parsed.success) return ["brief_schema_invalid"];

  const failures: string[] = [];
  if (parsed.data.topOfMind !== expectedWorry(answers)) failures.push("worry_not_transcript_bound");
  if (parsed.data.inTheirWords.some((quote) => !quoteAppearsInTranscript(quote, answers))) {
    failures.push("quotation_not_transcript_bound");
  }
  return failures;
}

export function groundBrief(draftValue: unknown, answers: QaItem[]): Brief {
  const draft = BriefDraftSchema.parse(draftValue);
  const groundedQuotes = draft.inTheirWords.filter((quote) => quoteAppearsInTranscript(quote, answers));
  const result = BriefSchema.parse({
    ...draft,
    topOfMind: expectedWorry(answers),
    inTheirWords: groundedQuotes,
    quoteWarning: groundedQuotes.length !== draft.inTheirWords.length,
  });
  const failures = verifyBriefGrounding(result, answers);
  if (failures.length > 0) throw new Error(`Brief grounding failed: ${failures.join(",")}`);
  return result;
}
