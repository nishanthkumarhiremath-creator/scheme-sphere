import { NextResponse } from "next/server";

import {
  classifyGeminiError,
  generateGeminiText,
  getGeminiApiKey,
  getGeminiErrorMessage,
  getGeminiKeySource,
  getGeminiModel,
  getSafeGeminiKeyFingerprint,
  logGeminiRuntime
} from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  logGeminiRuntime("gemini-test");

  const apiKey = getGeminiApiKey();
  const diagnostic = {
    keyConfigured: Boolean(apiKey),
    keySource: getGeminiKeySource(),
    keyFingerprint: getSafeGeminiKeyFingerprint(apiKey),
    model: getGeminiModel()
  };

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        ...diagnostic,
        errorType: "missing_key",
        message: "GEMINI_API_KEY is missing from the server runtime."
      },
      { status: 500 }
    );
  }

  try {
    const text = await generateGeminiText(apiKey, "Reply with only: hello");

    return NextResponse.json(
      {
        ok: true,
        ...diagnostic,
        text
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    const errorType = classifyGeminiError(error);
    const message = getGeminiErrorMessage(error);

    console.error("[Gemini test route]", {
      errorType,
      message,
      ...diagnostic
    });

    return NextResponse.json(
      {
        ok: false,
        ...diagnostic,
        errorType,
        message
      },
      {
        status: errorType === "rate_limit" ? 429 : 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
