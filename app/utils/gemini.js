import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Global helper to call Gemini from anywhere in the app
 * @param {string} prompt - The input prompt for the AI
 * @param {string} modelName - Optional: defaults to 'gemini-2.5-flash'
 */
export async function askGemini(prompt, modelName = DEFAULT_MODEL) {
    if (typeof window !== "undefined") {
        throw new Error("Gemini API calls must go through server API routes.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing from the server environment.");
    }

    try {
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Failed to fetch response from Gemini engine.");
    }
}
