import { describe, expect, it } from "vitest";

import {
  BriefDraftSchema,
  InterviewReplySchema,
  SKIPPED_ANSWER,
  groundBrief,
  quoteAppearsInTranscript,
  type QaItem,
} from "../src/contracts.ts";

const answers: QaItem[] = [
  { question: "Why are you here?", answer: "The pain wakes me every night.", phaseLabel: "Your story", isWorry: false },
  { question: "When?", answer: "It began six weeks ago.", phaseLabel: "Timeline", isWorry: false },
  { question: "Impact?", answer: "I cannot walk to work.", phaseLabel: "Daily life", isWorry: false },
  { question: "Worry?", answer: "I am worried I will lose my job.", phaseLabel: "The worry", isWorry: true },
];

function draft(overrides: Record<string, unknown> = {}) {
  return {
    topOfMind: "model-generated replacement",
    mainConcern: "Pain at night",
    timeline: ["Six weeks"],
    symptoms: ["Pain"],
    impact: "Cannot walk to work",
    whatChanged: "",
    triedAlready: [],
    medications: "",
    questionsForDoctor: ["What should we discuss?"],
    inTheirWords: ["The pain wakes me every night."],
    ...overrides,
  };
}

describe("groundBrief", () => {
  it("copies the named worry from the reviewed transcript", () => {
    expect(groundBrief(draft(), answers).topOfMind).toBe("I am worried I will lose my job.");
  });

  it("removes invented quotations and reports the removal", () => {
    const result = groundBrief(draft({ inTheirWords: ["I never said this."] }), answers);
    expect(result.inTheirWords).toEqual([]);
    expect(result.quoteWarning).toBe(true);
  });

  it("does not quote a skipped answer", () => {
    const skipped = [...answers, { question: "Medicine?", answer: SKIPPED_ANSWER, phaseLabel: "Details", isWorry: false }];
    expect(quoteAppearsInTranscript(SKIPPED_ANSWER, skipped)).toBe(false);
  });

  it("bounds generated lists", () => {
    expect(() => BriefDraftSchema.parse(draft({ symptoms: Array.from({ length: 9 }, () => "x") }))).toThrow();
  });
});

describe("interview reply contract", () => {
  it("rejects an urgent flag without a reason", () => {
    expect(() => InterviewReplySchema.parse({ urgent: true, urgentReason: "", done: true, phaseLabel: "", question: "" })).toThrow();
  });

  it("rejects a continuing interview with no question", () => {
    expect(() => InterviewReplySchema.parse({ urgent: false, urgentReason: "", done: false, phaseLabel: "Story", question: "" })).toThrow();
  });
});
