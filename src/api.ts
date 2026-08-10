import {
  BriefSchema,
  InterviewReplySchema,
  ProviderConfigSchema,
  type Brief,
  type InterviewReply,
  type ProviderConfig,
  type QaItem,
} from "./contracts.ts";

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    const value: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof value === "object" && value !== null && "error" in value
        ? String(value.error)
        : "The service could not complete that request.";
      throw new Error(message);
    }
    return value;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The service took too long to respond. Your answers remain on this screen.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getProviderConfig(): Promise<ProviderConfig> {
  return ProviderConfigSchema.parse(await request("/api/config"));
}

export async function getNextQuestion(answers: QaItem[]): Promise<InterviewReply> {
  return InterviewReplySchema.parse(
    await request("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
  );
}

export async function createBrief(answers: QaItem[]): Promise<Brief> {
  return BriefSchema.parse(
    await request("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
  );
}
