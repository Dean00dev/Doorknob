import { describe, expect, it } from "vitest";

import {
  groundBrief,
  verifyBriefGrounding,
  type Brief,
  type QaItem,
} from "../src/contracts.ts";

const answers: QaItem[] = [
  { question: "Why?", answer: "The pain wakes me at night.", phaseLabel: "Story", isWorry: false },
  { question: "When?", answer: "It began in June.", phaseLabel: "Timeline", isWorry: false },
  { question: "Worry?", answer: "I worry about losing work.", phaseLabel: "The worry", isWorry: true },
];

const valid = groundBrief({
  topOfMind: "untrusted model value",
  mainConcern: "Night pain",
  timeline: ["It began in June."],
  symptoms: [],
  impact: "",
  whatChanged: "",
  triedAlready: [],
  medications: "",
  questionsForDoctor: [],
  inTheirWords: ["The pain wakes me at night."],
}, answers);

const mutants: Array<[string, (brief: Brief) => unknown, string]> = [
  ["replace-worry", (brief) => ({ ...brief, topOfMind: "model replacement" }), "worry_not_transcript_bound"],
  ["invent-quote", (brief) => ({ ...brief, inTheirWords: ["invented quotation"] }), "quotation_not_transcript_bound"],
  ["remove-required-field", (brief) => { const { mainConcern: _removed, ...rest } = brief; return rest; }, "brief_schema_invalid"],
  ["overflow-output-list", (brief) => ({ ...brief, symptoms: Array.from({ length: 9 }, () => "x") }), "brief_schema_invalid"],
];

describe("grounding self-falsification", () => {
  it.each(mutants)("detects %s", (_name, mutate, expected) => {
    expect(verifyBriefGrounding(mutate(valid), answers)).toContain(expected);
  });
});
