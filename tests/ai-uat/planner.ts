import type { Page } from "@playwright/test";
import type { AiUatCase, AiUatStatus } from "../../src/lib/ai-uat/catalogue";

export type AiPlannerActionType =
  | "click"
  | "fill"
  | "scroll"
  | "back"
  | "wait"
  | "navigate"
  | "screenshot"
  | "finish";

export type AiPlannerAction = {
  action: AiPlannerActionType;
  target: string | null;
  value: string | null;
  direction: "up" | "down" | null;
  status: AiUatStatus | null;
  reason: string;
};

export type AiPlannerHistoryEntry = {
  step: number;
  action: AiPlannerAction;
  urlBefore: string;
  urlAfter?: string;
  error?: string;
};

const ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: ["click", "fill", "scroll", "back", "wait", "navigate", "screenshot", "finish"],
    },
    target: { type: ["string", "null"] },
    value: { type: ["string", "null"] },
    direction: { type: ["string", "null"], enum: ["up", "down", null] },
    status: { type: ["string", "null"], enum: ["PASS", "FAIL", "BLOCKED", null] },
    reason: { type: "string" },
  },
  required: ["action", "target", "value", "direction", "status", "reason"],
} as const;

function sanitizeText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "<phone>")
    .replace(/\b\d{12,}\b/g, "<long-number>")
    .slice(0, 16_000);
}

function safeAbsoluteUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

function safeHistory(history: AiPlannerHistoryEntry[]): AiPlannerHistoryEntry[] {
  return history.slice(-8).map((entry) => ({
    ...entry,
    urlBefore: safeAbsoluteUrl(entry.urlBefore),
    ...(entry.urlAfter ? { urlAfter: safeAbsoluteUrl(entry.urlAfter) } : {}),
    ...(entry.error ? { error: sanitizeText(entry.error) } : {}),
  }));
}

/**
 * Build a privacy-minimised model context from UI chrome only. Deliberately
 * excludes table cells, free-form paragraphs and business data rows; the AI
 * gets headings, controls, labels and placeholders sufficient for navigation.
 */
async function getSanitizedUiChrome(page: Page): Promise<string> {
  const snapshot = await page
    .evaluate(() => {
      const out: string[] = [];
      const push = (kind: string, text: string | null | undefined) => {
        const value = (text ?? "").replace(/\s+/g, " ").trim();
        if (!value) return;
        out.push(`${kind}: ${value.slice(0, 180)}`);
      };
      const safeHref = (raw: string | null) => {
        if (!raw) return "";
        try {
          const url = new URL(raw, window.location.href);
          return `${url.origin}${url.pathname}`;
        } catch {
          return "<invalid-url>";
        }
      };

      document.querySelectorAll("h1,h2,h3").forEach((el) => push("heading", el.textContent));
      document.querySelectorAll("button").forEach((el) => push("button", el.getAttribute("aria-label") || el.textContent));
      document.querySelectorAll("a[href]").forEach((el) => {
        const anchor = el as HTMLAnchorElement;
        push("link", `${el.textContent ?? ""} -> ${safeHref(anchor.getAttribute("href"))}`);
      });
      document.querySelectorAll("label").forEach((el) => push("label", el.textContent));
      document.querySelectorAll("input,textarea,select").forEach((el) => {
        const input = el as HTMLInputElement;
        const descriptor =
          input.getAttribute("aria-label") ||
          input.getAttribute("placeholder") ||
          input.getAttribute("name") ||
          input.id ||
          el.tagName.toLowerCase();
        push("field", descriptor);
      });
      return out.slice(0, 220).join("\n");
    })
    .catch(() => "");
  return sanitizeText(snapshot || "<UI chrome snapshot unavailable>");
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as { output_text?: unknown; output?: unknown[] };
  if (typeof root.output_text === "string") return root.output_text;
  const chunks: string[] = [];
  for (const item of root.output ?? []) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content ?? [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n");
}

function isPlannerAction(value: unknown): value is AiPlannerAction {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AiPlannerAction>;
  return (
    typeof v.action === "string" &&
    ["click", "fill", "scroll", "back", "wait", "navigate", "screenshot", "finish"].includes(v.action) &&
    (v.target === null || typeof v.target === "string") &&
    (v.value === null || typeof v.value === "string") &&
    (v.direction === null || v.direction === "up" || v.direction === "down") &&
    (v.status === null || v.status === "PASS" || v.status === "FAIL" || v.status === "BLOCKED") &&
    typeof v.reason === "string"
  );
}

export function aiPlannerEnabled(): boolean {
  return process.env.AI_UAT_ENABLE_AI === "true" && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function requestAiPlannerAction(args: {
  page: Page;
  testCase: AiUatCase;
  history: AiPlannerHistoryEntry[];
}): Promise<AiPlannerAction> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      action: "finish",
      target: null,
      value: null,
      direction: null,
      status: "BLOCKED",
      reason: "OPENAI_API_KEY is not configured for the optional exploratory AI planner.",
    };
  }

  const uiChrome = await getSanitizedUiChrome(args.page);
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: [
        "You are a bounded exploratory UI tester for Oasis Baklawa Appverse.",
        "Choose exactly one next human-like action from the supplied action vocabulary.",
        "Never request JavaScript, shell, SQL, devtools, downloads, external websites, or account/security changes.",
        "Never choose a mutation-like action such as create, submit, approve, reject, delete, upload, record, lock, reserve, issue, release, save, send or confirm.",
        "Do not decide security truth from appearance alone: deterministic Playwright assertions remain authoritative.",
        "Prefer semantic visible controls and ordinary user behavior.",
        "Only use navigate when the target path appears in allowedRoutes or forbiddenRoutes; direct forbidden-route probes are intentional UAT checks.",
        `UAT case: ${JSON.stringify(args.testCase)}`,
        `Current URL: ${safeAbsoluteUrl(args.page.url())}`,
        `Prior actions: ${JSON.stringify(safeHistory(args.history))}`,
        `Sanitized UI chrome snapshot:\n${uiChrome}`,
      ].join("\n\n"),
    },
  ];

  const sendImages = process.env.AI_UAT_SEND_IMAGES === "true";
  if (sendImages) {
    if (process.env.AI_UAT_SYNTHETIC_TARGET !== "true") {
      throw new Error("AI_UAT_SEND_IMAGES=true requires AI_UAT_SYNTHETIC_TARGET=true to avoid sending live business screens to the model.");
    }
    const image = await args.page.screenshot({ type: "jpeg", quality: 55, fullPage: false });
    content.push({ type: "input_image", image_url: `data:image/jpeg;base64,${image.toString("base64")}` });
  }

  const controller = new AbortController();
  const deadlineMs = Math.min(Math.max(Number(process.env.AI_UAT_PLANNER_TIMEOUT_MS ?? 30_000) || 30_000, 5_000), 60_000);
  const timer = setTimeout(() => controller.abort(), deadlineMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.AI_UAT_MODEL?.trim() || "gpt-5.6-luna",
        store: false,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "appverse_ai_uat_action",
            strict: true,
            schema: ACTION_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        // The exploratory planner is optional. Provider quota/rate exhaustion must
        // not overwrite the authoritative deterministic Playwright result.
        return {
          action: "finish",
          target: null,
          value: null,
          direction: null,
          status: "BLOCKED",
          reason: "Optional AI planner unavailable (HTTP 429); deterministic Playwright assertions remain authoritative.",
        };
      }
      const errorBody = sanitizeText(await response.text());
      throw new Error(`AI planner request failed (${response.status}): ${errorBody.slice(0, 500)}`);
    }

    const payload = (await response.json()) as unknown;
    const output = extractOutputText(payload);
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      throw new Error(`AI planner returned non-JSON structured output: ${sanitizeText(output).slice(0, 500)}`);
    }
    if (!isPlannerAction(parsed)) {
      throw new Error(`AI planner returned an invalid action contract: ${sanitizeText(JSON.stringify(parsed)).slice(0, 500)}`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI planner request exceeded ${deadlineMs} ms deadline.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}