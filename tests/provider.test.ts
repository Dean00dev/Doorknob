import { describe, expect, it } from "vitest";

import { MockProvider, providerFromEnvironment } from "../server/provider.ts";
import type { QaItem } from "../src/contracts.ts";

describe("provider configuration", () => {
  it("defaults to local mock mode", () => {
    expect(providerFromEnvironment({}).config).toEqual({ provider: "mock", sendsDataToExternalProvider: false });
  });

  it("refuses Anthropic mode without an explicit key and model", () => {
    expect(() => providerFromEnvironment({ MODEL_PROVIDER: "anthropic" })).toThrow();
  });

  it("mock interview terminates within its bound", async () => {
    const provider = new MockProvider();
    const answers: QaItem[] = [];
    let reply = await provider.nextQuestion(answers);
    for (let index = 0; index < 12 && !reply.done; index += 1) {
      answers.push({ question: reply.question, answer: `Synthetic answer ${index}`, phaseLabel: reply.phaseLabel, isWorry: false });
      reply = await provider.nextQuestion(answers);
    }
    expect(reply.done).toBe(true);
    expect(answers.length).toBeLessThanOrEqual(12);
  });
});
