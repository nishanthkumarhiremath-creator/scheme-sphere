"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Sparkles, Mic, MicOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocale } from 'next-intl';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

type SpeechRecognitionResultEvent = Event & {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
        };
    };
};

type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const localeSpeechMap: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    kn: "kn-IN",
    ta: "ta-IN",
    te: "te-IN"
};

export default function AssistantPage() {
    const locale = useLocale();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your SchemeSphere AI Assistant. Ask me anything about government schemes, eligibility rules, or application processes!' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVoiceSupported, setIsVoiceSupported] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const transcriptRef = useRef("");
    const lastSentAtRef = useRef(0);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const speechWindow = window as SpeechWindow;
        setIsVoiceSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    }, []);

    const sendMessage = async (messageText: string) => {
        if (!messageText.trim() || isLoading) {
            return;
        }

        const now = Date.now();
        if (now - lastSentAtRef.current < 2000) {
            return;
        }
        lastSentAtRef.current = now;

        const userMessage = messageText.trim();
        setInput("");

        const updatedMessages = [
            ...messages,
            {
                role: "user",
                content: userMessage,
            } as Message,
        ];

        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ messages: updatedMessages.slice(-4) }),
            });

            if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) {
                throw new Error("Route intercepted by middleware");
            }

            const data = await response.json();

            if (response.ok) {
                setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
            } else {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: data.error || data.content || "The assistant is temporarily unavailable. Please try again shortly."
                }]);
            }
        } catch (error) {
            console.error("Assistant request failed", error);
            setMessages((prev) => [...prev, { role: 'assistant', content: "Failed to connect to the assistant server." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        void sendMessage(input);
    };

    const handleVoiceInput = () => {
        if (typeof window === "undefined" || !isVoiceSupported || isListening || isLoading) {
            return;
        }

        const speechWindow = window as SpeechWindow;
        const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

        if (!Recognition) {
            setIsVoiceSupported(false);
            return;
        }

        transcriptRef.current = "";
        const recognition = new Recognition();
        recognition.lang = localeSpeechMap[locale] ?? "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
            if (transcript) {
                transcriptRef.current = transcript;
                setInput(transcript);
            }
        };
        recognition.onend = () => {
            setIsListening(false);
            if (transcriptRef.current) {
                void sendMessage(transcriptRef.current);
            }
        };
        recognition.onerror = () => setIsListening(false);
        setIsListening(true);
        recognition.start();
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
            {/* Embedded CSS to cleanly handle markdown styling inside the bubbles */}
            <style jsx global>{`
                .markdown-reply p { margin-bottom: 0.75rem; }
                .markdown-reply p:last-child { margin-bottom: 0; }
                .markdown-reply strong { font-weight: 700; color: #10B981; }
                .markdown-reply ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
                .markdown-reply ol { list-style-type: decimal; padding-left: 1.25rem; margin-bottom: 0.75rem; }
                .markdown-reply li { margin-bottom: 0.25rem; }
            `}</style>

            {/* Top Header Banner */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 text-center">
                <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-emerald-400">
                    <Sparkles className="size-5" /> SchemeSphere AI Assistant
                </h1>
                {/* Updated subtitle banner model metadata */}
                <p className="text-xs text-gray-400 mt-1">Powered by Gemini 2.5 Flash • Trained on Government Scheme Guidelines</p>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex gap-3 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                    >
                        {msg.role !== 'user' && (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <Bot className="size-4" />
                            </div>
                        )}
                        <div
                            className={`rounded-xl px-4 py-3 text-sm max-w-[85%] leading-relaxed ${msg.role === 'user'
                                ? 'bg-emerald-600 text-slate-900 dark:text-white rounded-br-none'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                                }`}
                        >
                            {msg.role === 'user' ? (
                                msg.content
                            ) : (
                                <div className="markdown-reply">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-emerald-400 border border-slate-300 dark:border-slate-700">
                                <User className="size-4" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 max-w-3xl mx-auto justify-start">
                        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 animate-pulse">
                            <Bot className="size-4" />
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl rounded-bl-none px-4 py-3 text-sm animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>

            {/* Input Message Form */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-4">
                <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your scheme question here (e.g., PM-Kisan eligibility)..."
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={handleVoiceInput}
                        disabled={!isVoiceSupported || isListening || isLoading}
                        title={!isVoiceSupported ? "Voice input not supported in this browser." : "Voice input"}
                        className={`flex items-center justify-center rounded-xl border px-3 transition-colors disabled:opacity-50 ${isListening
                            ? 'border-rose-500 bg-rose-500/10 text-rose-500 ring-2 ring-rose-500/30 animate-pulse'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400'
                            }`}
                    >
                        {isVoiceSupported ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center justify-center rounded-xl bg-emerald-600 px-4 text-slate-900 dark:text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    >
                        <Send className="size-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
