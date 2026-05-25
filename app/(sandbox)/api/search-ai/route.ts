import { NextResponse } from "next/server";

import {
    classifyGeminiError,
    enforceGeminiCooldown,
    GeminiRateLimitError,
    generateGeminiText,
    getCachedGeminiText,
    getGeminiErrorMessage,
    getGeminiApiKey,
    getRequestClientKey,
    logGeminiRuntime
} from "@/lib/gemini";

type SchemeAiItem = {
    end_date?: string;
    required_documents?: unknown;
    [key: string]: unknown;
};

type SchemeAiEnvelope = {
    schemes?: SchemeAiItem[];
    data?: SchemeAiItem[];
};

function parseSchemeResponse(rawText: string): SchemeAiItem[] {
    let parsedData: SchemeAiItem[] | SchemeAiEnvelope;
    try {
        parsedData = JSON.parse(rawText);
    } catch {
        const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleaned);
    }

    if (Array.isArray(parsedData)) {
        return parsedData;
    }

    return parsedData.schemes || parsedData.data || [];
}

export async function POST(req: Request) {
    try {
        const { query } = (await req.json()) as { query?: string };
        const normalizedQuery = query?.trim() || "latest welfare schemes";
        const apiKey = getGeminiApiKey();
        logGeminiRuntime("search-ai");

        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
        }

        const generationConfig = {
            responseMimeType: "application/json",
            temperature: 0.3
        } as const;

        const today = new Date().toISOString().split("T")[0];
        const systemPrompt = `You are SchemeSphere's Indian scheme matching engine.

Return ONLY a valid JSON array. Generate 8 to 10 relevant central, state, or CSR schemes matching the user query.
Today is ${today}. end_date must be a future date after today. If no official deadline is known, use an empty string.
required_documents must contain 4 to 6 realistic scheme-specific documents.

JSON item shape:
{
  "id": "unique-slug",
  "title": "Full Official Scheme Name",
  "provider": "Central Government",
  "ministry": "Ministry Name",
  "category": "Scholarships",
  "description": "Detailed description of what this scheme provides.",
  "benefits": "Precise financial or resource metrics.",
  "eligibility": "Target group conditions matched.",
  "link": "https://official-portal-url.gov.in",
  "required_documents": ["Document 1", "Document 2", "Document 3", "Document 4"],
  "end_date": "2026-10-31"
}`;
        const prompt = `${systemPrompt}\n\nUser query: ${normalizedQuery}`;
        const cachedText = getCachedGeminiText(prompt, generationConfig);
        const waitSeconds = cachedText ? 0 : enforceGeminiCooldown(getRequestClientKey(req, "search-ai"), 7000);

        if (waitSeconds > 0) {
            return NextResponse.json(
                { error: `Please wait ${waitSeconds}s before searching again.`, retryAfter: waitSeconds },
                { status: 429 }
            );
        }

        const rawText = cachedText ?? await generateGeminiText(apiKey, prompt, generationConfig);
        const parsedItems = parseSchemeResponse(rawText);

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const safeData = parsedItems.map((item) => {
            const d = new Date(item.end_date ?? "");
            const safeDateStr = (!item.end_date || isNaN(d.getTime()) || d < todayDate) ? "" : item.end_date;
            return {
                ...item,
                end_date: safeDateStr,
                required_documents: Array.isArray(item.required_documents) && item.required_documents.length > 0
                    ? item.required_documents
                    : []
            };
        });

        return NextResponse.json(safeData);

    } catch (error) {
        if (error instanceof GeminiRateLimitError) {
            console.error("AI Search Gemini Error:", {
                errorType: "rate_limit",
                message: getGeminiErrorMessage(error)
            });
            return NextResponse.json(
                { error: "Gemini is temporarily rate limited. Please try again shortly.", retryAfter: 60 },
                { status: 429 }
            );
        }

        const message = getGeminiErrorMessage(error);
        console.error("AI Search Error:", {
            errorType: classifyGeminiError(error),
            message,
            error
        });
        return NextResponse.json({ error: "Failed to fetch schemes: " + message }, { status: 500 });
    }
}
