import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../server/app.ts";
import type { ModelProvider } from "../server/provider.ts";
import type { BriefDraft, InterviewReply, QaItem } from "../src/contracts.ts";

const baseAnswers: QaItem[] = [
  { question: "Why?", answer: "Night pain", phaseLabel: "Story", isWorry: false },
  { question: "When?", answer: "Six weeks", phaseLabel: "Timeline", isWorry: false },
  { question: "Worry?", answer: "I worry about work", phaseLabel: "The worry", isWorry: true },
];

class StubProvider implements ModelProvider {
  readonly config = { provider: "mock", sendsDataToExternalProvider: false } as const;
  constructor(private readonly shouldFail = false) {}

  async nextQuestion(_answers: QaItem[]): Promise<InterviewReply> {
    if (this.shouldFail) throw new Error("private provider detail");
    return { urgent: false, urgentReason: "", done: false, phaseLabel: "Timeline", question: "When?" };
  }

  async buildBrief(_answers: QaItem[]): Promise<BriefDraft> {
    if (this.shouldFail) throw new Error("private provider detail");
    return {
      topOfMind: "invented worry",
      mainConcern: "Night pain",
      timeline: ["Six weeks"],
      symptoms: [],
      impact: "",
      whatChanged: "",
      triedAlready: [],
      medications: "",
      questionsForDoctor: [],
      inTheirWords: ["This quotation was invented"],
    };
  }
}

describe("API boundary", () => {
  it("discloses the active provider route", async () => {
    const response = await request(createApp(new StubProvider(), { rateLimitEnabled: false })).get("/api/config");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ provider: "mock", sendsDataToExternalProvider: false });
  });

  it("rejects malformed interview input", async () => {
    const response = await request(createApp(new StubProvider(), { rateLimitEnabled: false }))
      .post("/api/interview")
      .send({ answers: [{ question: "", answer: "x", phaseLabel: "x", isWorry: false }] });
    expect(response.status).toBe(400);
  });

  it("grounds the worry and removes an invented quotation", async () => {
    const response = await request(createApp(new StubProvider(), { rateLimitEnabled: false }))
      .post("/api/brief")
      .send({ answers: baseAnswers });
    expect(response.status).toBe(200);
    expect(response.body.topOfMind).toBe("I worry about work");
    expect(response.body.inTheirWords).toEqual([]);
    expect(response.body.quoteWarning).toBe(true);
  });

  it("does not expose provider error details", async () => {
    const response = await request(createApp(new StubProvider(true), { rateLimitEnabled: false }))
      .post("/api/interview")
      .send({ answers: [] });
    expect(response.status).toBe(502);
    expect(JSON.stringify(response.body)).not.toContain("private provider detail");
  });

  it("rejects a body above the server limit", async () => {
    const response = await request(createApp(new StubProvider(), { rateLimitEnabled: false }))
      .post("/api/interview")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ answers: [{ question: "q", answer: "x".repeat(70_000), phaseLabel: "p", isWorry: false }] }));
    expect(response.status).toBe(413);
  });
});
