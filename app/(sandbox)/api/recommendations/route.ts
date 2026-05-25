import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  classifyGeminiError,
  GeminiRateLimitError,
  generateGeminiText,
  getCachedGeminiText,
  getGeminiApiKey,
  getGeminiErrorMessage,
  logGeminiRuntime
} from "@/lib/gemini";

export const dynamic = "force-dynamic";

type RecommendedScheme = {
  title: string;
  benefit?: string;
  link: string;
};

type RecommendationEnvelope = {
  schemes?: unknown;
};

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      return NextResponse.json({ schemes: [] });
    }

    const apiKey = getGeminiApiKey();
    logGeminiRuntime("recommendations");

    if (!apiKey) {
      return NextResponse.json({ schemes: [], warning: "Gemini API key is not configured." });
    }

    const generationConfig = {
        responseMimeType: "application/json",
        temperature: 0.2
      } as const;

    const prompt = `You are SchemeSphere's recommendation engine. Return only valid JSON for real Indian government or private schemes.

Find 4 currently relevant Indian government or private schemes for this authenticated user profile:
- State: ${profile.state}
- Social category: ${profile.category}
- Occupation/status: ${profile.occupation}
- Annual family income: ${profile.incomeLimit}
- Age: ${profile.age ?? "Not provided"}
- Gender: ${profile.gender ?? "Not provided"}

Return JSON ONLY in this exact shape — no explanation text:
{
  "schemes": [
    {
      "title": "Official scheme name",
      "benefit": "Short benefit summary",
      "link": "https://official-url.gov.in"
    }
  ]
}`;

    const rawText = getCachedGeminiText(prompt, generationConfig) ?? await generateGeminiText(apiKey, prompt, generationConfig);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const envelope = parsed as RecommendationEnvelope;
    const schemes = Array.isArray(parsed) ? parsed : (Array.isArray(envelope.schemes) ? envelope.schemes : []);

    // Validate and filter to only items with title + link
    const valid = schemes.filter(
      (scheme): scheme is RecommendedScheme =>
        typeof scheme === 'object' &&
        scheme !== null &&
        typeof (scheme as RecommendedScheme).title === 'string' &&
        typeof (scheme as RecommendedScheme).link === 'string'
    ).slice(0, 6);

    return NextResponse.json({ schemes: valid });

  } catch (error) {
    if (error instanceof GeminiRateLimitError) {
      console.error("AI Recommendation Gemini Error:", {
        errorType: "rate_limit",
        message: getGeminiErrorMessage(error)
      });
      return NextResponse.json({ schemes: [], warning: "Gemini is temporarily rate limited. Please try again shortly." });
    }

    console.error("AI Recommendation Error:", {
      errorType: classifyGeminiError(error),
      message: getGeminiErrorMessage(error),
      error
    });
    return NextResponse.json({ schemes: [] });
  }
}
