import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { InterviewReplySchema, InterviewRequestSchema, groundBrief } from "../src/contracts.js";
import type { ModelProvider } from "./provider.js";

export interface AppOptions {
  rateLimitEnabled?: boolean;
}

export function createApp(provider: ModelProvider, options: AppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb", strict: true }));

  if (options.rateLimitEnabled !== false) {
    app.use(
      "/api",
      rateLimit({
        windowMs: 10 * 60 * 1_000,
        limit: 40,
        standardHeaders: "draft-8",
        legacyHeaders: false,
      }),
    );
  }

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/config", (_request, response) => {
    response.json(provider.config);
  });

  app.post("/api/interview", async (request, response, next) => {
    const parsed = InterviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "The request was invalid." });
      return;
    }
    try {
      const candidate = await provider.nextQuestion(parsed.data.answers);
      const reply = InterviewReplySchema.safeParse(candidate);
      if (!reply.success) throw new Error("Provider returned an invalid interview reply.");
      response.json(reply.data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/brief", async (request, response, next) => {
    const parsed = InterviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "The request was invalid." });
      return;
    }
    try {
      const { answers } = parsed.data;
      if (answers.length < 3) {
        response.status(400).json({ error: "At least three answers are required before creating a brief." });
        return;
      }
      const draft = await provider.buildBrief(answers);
      response.json(groundBrief(draft, answers));
    } catch (error) {
      next(error);
    }
  });

  const errors: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error?.type === "entity.parse.failed") {
      response.status(400).json({ error: "The request was invalid." });
      return;
    }
    if (error?.type === "entity.too.large") {
      response.status(413).json({ error: "The request was too large." });
      return;
    }
    response.status(502).json({ error: "The interview service could not produce a valid response." });
  };
  app.use(errors);
  return app;
}
