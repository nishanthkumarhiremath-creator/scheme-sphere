import { NextResponse } from "next/server";

import {
    classifyGeminiError,
    enforceGeminiCooldown,
    GeminiRateLimitError,
    generateGeminiText,
    getCachedGeminiText,
    getGeminiApiKey,
    getGeminiErrorMessage,
    getRequestClientKey,
    logGeminiRuntime
} from "@/lib/gemini";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export async function POST(request: Request) {
    try {
        const { messages } = (await request.json()) as { messages?: ChatMessage[] };

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: "No messages provided" }, { status: 400 });
        }

        const latestMessage = messages[messages.length - 1]?.content;
        const apiKey = getGeminiApiKey();
        logGeminiRuntime("chat");

        if (!latestMessage) {
            return NextResponse.json({ error: "No message content provided" }, { status: 400 });
        }

        if (!apiKey || apiKey.trim() === "") {
            return NextResponse.json({
                role: "assistant",
                content: "System Configuration Error: GEMINI_API_KEY is missing from the server environment."
            });
        }

        const compactHistory = messages.slice(-4).map((message) => `${message.role}: ${message.content}`).join("\n");
        const prompt = `You are SchemeSphere's concise scheme assistant. Answer only scheme, eligibility, document, and application questions.\n\n${compactHistory}`;
        const cachedText = getCachedGeminiText(prompt);
        const waitSeconds = cachedText ? 0 : enforceGeminiCooldown(getRequestClientKey(request, "chat"), 5000);

        if (waitSeconds > 0) {
            return NextResponse.json({
                role: "assistant",
                content: `Please wait ${waitSeconds}s before sending another assistant request.`
            }, { status: 429 });
        }

        const responseText = cachedText ?? await generateGeminiText(apiKey, prompt);

        return NextResponse.json({ role: "assistant", content: responseText });

    } catch (error) {
        if (error instanceof GeminiRateLimitError) {
            console.error("Gemini Chat Error:", {
                errorType: "rate_limit",
                message: getGeminiErrorMessage(error)
            });
            return NextResponse.json({
                role: "assistant",
                content: "Gemini is temporarily rate limited. Please try again shortly.",
                error: "Gemini quota exceeded."
            }, { status: 429 });
        }

        const message = getGeminiErrorMessage(error);
        console.error("Gemini API Route Error:", {
            errorType: classifyGeminiError(error),
            message,
            error
        });
        return NextResponse.json(
            {
                role: "assistant",
                content: "I could not reach the Gemini engine right now. Please try again in a moment.",
                error: "Failed to fetch response from Gemini engine. Details: " + message
            },
            { status: 500 }
        );
    }
}
