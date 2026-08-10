import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";

import { createApp } from "./app.js";
import { providerFromEnvironment } from "./provider.js";

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");

const app = createApp(providerFromEnvironment(process.env));
const dist = path.resolve(process.cwd(), "dist");

if (existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html")) {
      response.sendFile(path.join(dist, "index.html"));
      return;
    }
    next();
  });
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Doorknob listening on http://127.0.0.1:${port} in ${process.env.MODEL_PROVIDER ?? "mock"} mode.`);
});
