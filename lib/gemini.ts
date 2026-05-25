import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-2.5-flash";
const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; text: string }>();
const cooldowns = new Map<string, number>();

function makeCacheKey(prompt: string, generationConfig?: GenerationConfig) {
  return JSON.stringify({ prompt, generationConfig });
}

export class GeminiRateLimitError extends Error {
  constructor(message = "Gemini quota is temporarily exhausted.") {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

export type GeminiErrorKind =
  | "auth"
  | "bad_request"
  | "model_not_found"
  | "network"
  | "rate_limit"
  | "unknown";

export function getGeminiModel() {
  return GEMINI_MODEL;
}

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim();
}

export function getGeminiKeySource() {
  return process.env.GEMINI_API_KEY?.trim() ? "GEMINI_API_KEY" : "missing";
}

export function getSafeGeminiKeyFingerprint(apiKey = getGeminiApiKey()) {
  if (!apiKey) {
    return null;
  }

  let hash = 0;
  for (let i = 0; i < apiKey.length; i += 1) {
    hash = (hash * 31 + apiKey.charCodeAt(i)) >>> 0;
  }

  return {
    length: apiKey.length,
    prefix: apiKey.slice(0, 6),
    suffix: apiKey.slice(-4),
    hash: hash.toString(16).padStart(8, "0")
  };
}

export function classifyGeminiError(error: unknown): GeminiErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    message.includes("429") ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "rate_limit";
  }

  if (
    message.includes("400") ||
    normalized.includes("invalid argument") ||
    normalized.includes("bad request") ||
    normalized.includes("malformed")
  ) {
    return "bad_request";
  }

  if (
    message.includes("401") ||
    message.includes("403") ||
    normalized.includes("api key not valid") ||
    normalized.includes("permission denied") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "auth";
  }

  if (
    message.includes("404") ||
    normalized.includes("not found") ||
    normalized.includes("not supported")
  ) {
    return "model_not_found";
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound") ||
    normalized.includes("etimedout")
  ) {
    return "network";
  }

  return "unknown";
}

export function getGeminiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function logGeminiRuntime(scope: string) {
  if (process.env.GEMINI_DEBUG !== "true") {
    return;
  }

  console.info("[Gemini runtime]", {
    scope,
    keySource: getGeminiKeySource(),
    keyFingerprint: getSafeGeminiKeyFingerprint(),
    model: getGeminiModel()
  });
}

export async function generateGeminiContent(
  apiKey: string,
  prompt: string,
  generationConfig?: GenerationConfig
) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getGeminiModel(),
    generationConfig
  });

  return model.generateContent(prompt);
}

export function enforceGeminiCooldown(key: string, cooldownMs: number) {
  const now = Date.now();
  const previous = cooldowns.get(key) ?? 0;

  if (now - previous < cooldownMs) {
    return Math.ceil((cooldownMs - (now - previous)) / 1000);
  }

  cooldowns.set(key, now);
  return 0;
}

export function getRequestClientKey(req: Request, scope: string) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return `${scope}:${forwarded || realIp || "local"}`;
}

export async function generateGeminiText(
  apiKey: string,
  prompt: string,
  generationConfig?: GenerationConfig
) {
  const cacheKey = makeCacheKey(prompt, generationConfig);
  const cached = responseCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  try {
    const result = await generateGeminiContent(apiKey, prompt, generationConfig);
    const text = result.response.text();
    responseCache.set(cacheKey, {
      text,
      expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS
    });
    return text;
  } catch (error) {
    if (classifyGeminiError(error) === "rate_limit") {
      throw new GeminiRateLimitError(getGeminiErrorMessage(error));
    }

    throw error;
  }
}

export function getCachedGeminiText(
  prompt: string,
  generationConfig?: GenerationConfig
) {
  const cached = responseCache.get(makeCacheKey(prompt, generationConfig));
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached.text;
}
