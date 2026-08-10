import Anthropic from "@anthropic-ai/sdk";

import {
  BriefDraftSchema,
  type BriefDraft,
  InterviewReplySchema,
  type InterviewReply,
  type ProviderConfig,
  type QaItem,
} from "../src/contracts.js";
import { BRIEF_SYSTEM, INTERVIEW_SYSTEM, interviewPayload } from "./prompts.js";

export interface ModelProvider {
  readonly config: ProviderConfig;
  nextQuestion(answers: QaItem[]): Promise<InterviewReply>;
  buildBrief(answers: QaItem[]): Promise<BriefDraft>;
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```(?:json)?|```/gi, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model response did not contain a JSON object.");
  return JSON.parse(clean.slice(start, end + 1));
}

const MOCK_QUESTIONS = [
  ["Your story", "What has brought you to book this appointment?"],
  ["Timeline", "When did you first notice this, and how has it changed?"],
  ["What it is like", "What does it feel like when it is at its worst?"],
  ["Daily life", "How does it affect an ordinary day for you?"],
  ["Changes", "Does anything make it better or worse?"],
  ["What you tried", "What have you already tried, if anything?"],
  ["Relevant details", "Are there any medicines or existing conditions you think the clinician should know about?"],
  ["Your questions", "What do you most need the clinician to answer?"],
] as const;

export class MockProvider implements ModelProvider {
  readonly config = { provider: "mock", sendsDataToExternalProvider: false } as const;

  async nextQuestion(answers: QaItem[]): Promise<InterviewReply> {
    const next = MOCK_QUESTIONS[answers.length];
    if (!next) {
      return { urgent: false, urgentReason: "", done: true, phaseLabel: "Done", question: "" };
    }
    return { urgent: false, urgentReason: "", done: false, phaseLabel: next[0], question: next[1] };
  }

  async buildBrief(answers: QaItem[]): Promise<BriefDraft> {
    const usable = answers.filter((item) => item.answer !== "[Skipped]");
    const answerAt = (index: number): string => usable[index]?.answer ?? "Not discussed.";
    return BriefDraftSchema.parse({
      topOfMind: "",
      mainConcern: answerAt(0),
      timeline: usable[1] ? [usable[1].answer] : [],
      symptoms: usable[2] ? [usable[2].answer] : [],
      impact: usable[3]?.answer ?? "",
      whatChanged: usable[4]?.answer ?? "",
      triedAlready: usable[5] ? [usable[5].answer] : [],
      medications: usable[6]?.answer ?? "",
      questionsForDoctor: usable.at(-1) ? [usable.at(-1)!.answer] : [],
      inTheirWords: usable[0] ? [usable[0].answer] : [],
    });
  }
}

export class AnthropicProvider implements ModelProvider {
  readonly config = { provider: "anthropic", sendsDataToExternalProvider: true } as const;
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async complete(system: string, answers: QaItem[], maxTokens: number): Promise<unknown> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: interviewPayload(answers) }],
    });
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    if (!text.trim()) throw new Error("Model returned an empty response.");
    return extractJson(text);
  }

  async nextQuestion(answers: QaItem[]): Promise<InterviewReply> {
    return InterviewReplySchema.parse(await this.complete(INTERVIEW_SYSTEM, answers, 600));
  }

  async buildBrief(answers: QaItem[]): Promise<BriefDraft> {
    return BriefDraftSchema.parse(await this.complete(BRIEF_SYSTEM, answers, 2_400));
  }
}

export function providerFromEnvironment(environment: NodeJS.ProcessEnv): ModelProvider {
  const provider = environment.MODEL_PROVIDER ?? "mock";
  if (provider === "mock") return new MockProvider();
  if (provider !== "anthropic") throw new Error("MODEL_PROVIDER must be 'mock' or 'anthropic'.");

  const apiKey = environment.ANTHROPIC_API_KEY;
  const model = environment.ANTHROPIC_MODEL;
  if (!apiKey || !model) {
    throw new Error("Anthropic mode requires ANTHROPIC_API_KEY and ANTHROPIC_MODEL.");
  }
  return new AnthropicProvider(apiKey, model);
}
