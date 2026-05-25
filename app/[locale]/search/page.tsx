"use client";

import { getSavedBookmarks, toggleBookmark } from "@/app/actions/bookmarks";
import { getDeadlineDisplay, type DeadlineUrgency } from "@/lib/deadline";
import { useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowRight,
    Calendar,
    ChevronDown,
    ChevronUp,
    FileText,
    Filter,
    Heart,
    Loader2,
    Mic,
    MicOff,
    Scale,
    Search,
    Sparkles,
    X
} from "lucide-react";

interface Scheme {
    id: string;
    title: string;
    provider: string;
    ministry: string;
    category: string;
    description: string;
    benefits: string;
    eligibility: string;
    link: string;
    required_documents?: string[];
    end_date?: string;
}

interface SearchAiScheme extends Omit<Scheme, "id"> {
    id?: string;
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
    stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type CategoryKey =
    | "All"
    | "Scholarships"
    | "Technical/STEM"
    | "Minority/SC/ST"
    | "Agriculture"
    | "Healthcare"
    | "Business";

const localeSpeechMap: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    kn: "kn-IN",
    ta: "ta-IN",
    te: "te-IN"
};

const categories: Array<{ key: CategoryKey; labelKey: string }> = [
    { key: "All", labelKey: "categoryAll" },
    { key: "Scholarships", labelKey: "categoryScholarships" },
    { key: "Technical/STEM", labelKey: "categoryTechnical" },
    { key: "Minority/SC/ST", labelKey: "categoryMinority" },
    { key: "Agriculture", labelKey: "categoryAgriculture" },
    { key: "Healthcare", labelKey: "categoryHealthcare" },
    { key: "Business", labelKey: "categoryBusiness" }
];

function ensureFutureDate(dateStr: string | undefined): string {
    if (!dateStr) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    if (isNaN(d.getTime()) || d < today) return "";
    return dateStr;
}

function deadlineClassName(urgency: DeadlineUrgency): string {
    if (urgency === "urgent") {
        return "bg-rose-500/10 border-rose-500/50 text-rose-500 animate-pulse shadow-sm shadow-rose-500/30";
    }

    if (urgency === "warning") {
        return "bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-sm shadow-amber-500/20";
    }

    return "bg-rose-500/10 border-rose-500/20 text-rose-500";
}

function DeadlineBadge({ endDate }: { endDate?: string }) {
    const display = getDeadlineDisplay(endDate ?? "");

    if (display.urgency === "hidden") {
        return null;
    }

    return (
        <div className={`flex items-center gap-1 border text-[10px] font-bold px-2 py-0.5 rounded-md ${deadlineClassName(display.urgency)}`}>
            <Calendar className="size-3" />
            {display.label}
        </div>
    );
}

function formatApplicationEndDate(endDate?: string) {
    if (!endDate) {
        return "No deadline specified";
    }

    const date = new Date(endDate);
    if (Number.isNaN(date.getTime())) {
        return "No deadline specified";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(date);
}

export default function SearchPage() {
    const { isLoaded, isSignedIn, user } = useUser();
    const locale = useLocale();
    const t = useTranslations("search");
    const landing = useTranslations("landing");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("All");
    const [schemes, setSchemes] = useState<Scheme[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeModalScheme, setActiveModalScheme] = useState<Scheme | null>(null);
    const [savedSchemeIds, setSavedSchemeIds] = useState<Set<string>>(new Set());
    const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);
    const [isVoiceSupported, setIsVoiceSupported] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSchemes, setSelectedSchemes] = useState<Scheme[]>([]);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const [searchError, setSearchError] = useState("");
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const initialSearchDoneRef = useRef(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightSearchRef = useRef(false);
    const lastSearchAtRef = useRef(0);

    const triggerAISearch = useCallback(async (queryText: string) => {
        const now = Date.now();
        if (inFlightSearchRef.current || now - lastSearchAtRef.current < 1200) {
            return;
        }

        try {
            inFlightSearchRef.current = true;
            lastSearchAtRef.current = now;
            setSearchError("");
            setIsLoading(true);
            const response = await fetch("/api/search-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryText || "latest welfare schemes" }),
            });

            const data = await response.json();

            if (!response.ok) {
                setSearchError(typeof data?.error === "string" ? data.error : "AI search is temporarily unavailable. Please try again shortly.");
                return;
            }

            if (Array.isArray(data)) {
                const normalizedData: Scheme[] = (data as SearchAiScheme[]).map((item, index) => ({
                    id: item.id ?? `${item.title}-${item.link}-${index}`,
                    title: item.title,
                    provider: item.provider,
                    ministry: item.ministry,
                    category: item.category,
                    description: item.description,
                    benefits: item.benefits,
                    eligibility: item.eligibility,
                    link: item.link,
                    end_date: ensureFutureDate(item.end_date),
                    required_documents: Array.isArray(item.required_documents) && item.required_documents.length > 0
                        ? item.required_documents
                        : []
                }));

                setSchemes(normalizedData);
                setSelectedSchemes((current) =>
                    current.filter((selected) => normalizedData.some((scheme) => scheme.id === selected.id))
                );
            }
        } catch (error) {
            console.error("Failed fetching search data", error);
            setSearchError("AI search is temporarily unavailable. Please try again shortly.");
        } finally {
            inFlightSearchRef.current = false;
            setIsLoading(false);
        }
    }, []);

    const scheduleAISearch = useCallback((queryText: string, delay = 450) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            void triggerAISearch(queryText);
        }, delay);
    }, [triggerAISearch]);

    useEffect(() => {
        if (initialSearchDoneRef.current) {
            return;
        }

        initialSearchDoneRef.current = true;
        scheduleAISearch("trending national scholarships and agricultural schemes", 250);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [scheduleAISearch]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const speechWindow = window as SpeechWindow;
        setIsVoiceSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    }, []);

    useEffect(() => {
        if (isLoaded && isSignedIn && user?.id) {
            getSavedBookmarks(user.id).then((bookmarks) => {
                setSavedSchemeIds(new Set(bookmarks.map((bookmark) => bookmark.schemeId)));
            });
        } else if (isLoaded) {
            setSavedSchemeIds(new Set());
        }
    }, [isLoaded, isSignedIn, user?.id]);

    const suggestionItems = useMemo(() => {
        const landingExamples = landing.raw("examples") as string[];
        const prompts = t.raw("suggestions") as string[];
        return [...landingExamples, ...prompts].slice(0, 10);
    }, [landing, t]);

    const visibleSuggestions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (query.length >= 2) {
            return suggestionItems
                .filter((item) => item.toLowerCase().startsWith(query))
                .slice(0, 5);
        }

        return searchQuery.trim() ? [] : suggestionItems;
    }, [searchQuery, suggestionItems]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            setShowSuggestions(false);
            scheduleAISearch(searchQuery);
        }
    };

    const runSuggestionSearch = (suggestion: string) => {
        setSearchQuery(suggestion);
        setShowSuggestions(false);
        scheduleAISearch(suggestion);
    };

    const handleVoiceSearch = () => {
        if (typeof window === "undefined" || !isVoiceSupported || isRecording) {
            return;
        }

        const speechWindow = window as SpeechWindow;
        const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

        if (!Recognition) {
            setIsVoiceSupported(false);
            return;
        }

        const recognition = new Recognition();
        recognition.lang = localeSpeechMap[locale] ?? "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
            if (transcript) {
                setSearchQuery(transcript);
                setShowSuggestions(false);
                scheduleAISearch(transcript);
            }
        };
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = () => setIsRecording(false);
        recognitionRef.current = recognition;
        setIsRecording(true);
        recognition.start();
    };

    const handleToggleBookmark = async (scheme: Scheme) => {
        if (!user?.id) {
            alert(t("signInToSave"));
            return;
        }

        const result = await toggleBookmark(user.id, {
            schemeId: scheme.id,
            title: scheme.title,
            benefit: scheme.benefits,
            link: scheme.link
        });

        setSavedSchemeIds((current) => {
            const next = new Set(current);
            if (result.bookmarked) {
                next.add(scheme.id);
            } else {
                next.delete(scheme.id);
            }
            return next;
        });
    };

    const toggleComparison = (scheme: Scheme) => {
        setSelectedSchemes((current) => {
            if (current.some((item) => item.id === scheme.id)) {
                return current.filter((item) => item.id !== scheme.id);
            }

            if (current.length >= 3) {
                return current;
            }

            return [...current, scheme];
        });
    };

    const filteredSchemes = schemes.filter(scheme => {
        if (selectedCategory === "All") return true;

        if (selectedCategory === "Technical/STEM") {
            return scheme.title.toLowerCase().includes("stem") ||
                scheme.title.toLowerCase().includes("engineer") ||
                scheme.title.toLowerCase().includes("technology") ||
                scheme.description.toLowerCase().includes("technical") ||
                scheme.category.toLowerCase().includes("technical");
        }

        if (selectedCategory === "Minority/SC/ST") {
            return scheme.eligibility.toLowerCase().includes("sc") ||
                scheme.eligibility.toLowerCase().includes("st") ||
                scheme.eligibility.toLowerCase().includes("minority") ||
                scheme.title.toLowerCase().includes("matric") ||
                scheme.description.toLowerCase().includes("backward");
        }

        return scheme.category === selectedCategory;
    });

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-6 relative">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
                        <Sparkles className="size-6 text-emerald-400" /> {t("title")}
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t("subtitle")} <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono">Enter</kbd>
                    </p>
                </div>

                <div className="relative">
                    <div className="relative flex items-center">
                        <Search className="absolute left-4 size-5 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onKeyDown={handleKeyDown}
                            placeholder={t("placeholder")}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-32 py-4 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                        <button
                            onClick={handleVoiceSearch}
                            disabled={!isVoiceSupported || isRecording}
                            title={!isVoiceSupported ? t("voiceUnsupported") : t("voiceSearch")}
                            className={`absolute right-20 flex size-9 items-center justify-center rounded-lg border text-slate-600 dark:text-slate-300 transition-colors ${isRecording
                                ? "border-rose-500 bg-rose-500/10 text-rose-500 ring-2 ring-rose-500/30 animate-pulse"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-45 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-800"
                                }`}
                            type="button"
                        >
                            {isVoiceSupported ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                        </button>
                        <button
                            onClick={() => {
                                setShowSuggestions(false);
                                scheduleAISearch(searchQuery);
                            }}
                            className="absolute right-3 bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                            type="button"
                        >
                            {t("searchButton")}
                        </button>
                    </div>

                    {showSuggestions && visibleSuggestions.length > 0 ? (
                        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                            {visibleSuggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => runSuggestionSearch(suggestion)}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-500"
                                >
                                    <Search className="size-3.5 shrink-0" />
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1 mr-2">
                        <Filter className="size-3" /> {t("filterBy")}
                    </span>
                    {categories.map((category) => (
                        <button
                            key={category.key}
                            onClick={() => setSelectedCategory(category.key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategory === category.key
                                ? "bg-emerald-600 text-slate-900 dark:text-white shadow-md"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            type="button"
                        >
                            {t(category.labelKey)}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 space-y-3 border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/20 rounded-2xl">
                        <Loader2 className="size-8 text-emerald-400 animate-spin" />
                        <p className="text-sm text-slate-600 dark:text-slate-400 animate-pulse">{t("loading")}</p>
                    </div>
                ) : (
                    <>
                    {searchError ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                            {searchError}
                        </div>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                        {filteredSchemes.length > 0 ? (
                            filteredSchemes.map((scheme) => {
                                const isDocsExpanded = expandedSchemeId === scheme.id;
                                const isSelectedForCompare = selectedSchemes.some((item) => item.id === scheme.id);

                                return (
                                    <div
                                        key={scheme.id}
                                        className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between hover:shadow-lg hover:shadow-emerald-950/10 pt-8"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-start w-full gap-2">
                                                <div className="truncate max-w-[60%] space-y-1">
                                                    <span className="text-[11px] text-slate-500 font-medium block truncate">
                                                        {scheme.ministry}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            {scheme.category}
                                                        </span>
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase ${scheme.provider === "Private Sector"
                                                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                                            }`}>
                                                            {scheme.provider}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <DeadlineBadge endDate={scheme.end_date} />
                                                    <button
                                                        aria-label={savedSchemeIds.has(scheme.id) ? t("removeSaved") : t("saveScheme")}
                                                        className={`rounded-lg border p-1.5 transition-colors ${savedSchemeIds.has(scheme.id)
                                                            ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400"
                                                            }`}
                                                        onClick={() => handleToggleBookmark(scheme)}
                                                        type="button"
                                                    >
                                                        <Heart className={`size-3.5 ${savedSchemeIds.has(scheme.id) ? "fill-current" : ""}`} />
                                                    </button>
                                                </div>
                                            </div>

                                            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-emerald-400">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelectedForCompare}
                                                    disabled={!isSelectedForCompare && selectedSchemes.length >= 3}
                                                    onChange={() => toggleComparison(scheme)}
                                                    className="size-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 disabled:opacity-40"
                                                />
                                                {t("compare")}
                                            </label>

                                            <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 group-hover:text-emerald-400 transition-colors">
                                                {scheme.title}
                                            </h3>

                                            <p className="text-xs font-semibold text-rose-500">
                                                Application Ends: {formatApplicationEndDate(scheme.end_date)}
                                            </p>

                                            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                                {scheme.description}
                                            </p>
                                        </div>

                                        <div className="space-y-3 mt-5">
                                            <div className="border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedSchemeId(isDocsExpanded ? null : scheme.id)}
                                                    className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="size-3.5 text-emerald-400" /> {isDocsExpanded ? t("hideDocuments") : t("viewDocuments")}
                                                    </span>
                                                    {isDocsExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                                </button>

                                                {isDocsExpanded && (
                                                    <div className="mt-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                                        <ul className="space-y-1">
                                                            {scheme.required_documents?.map((doc, idx) => (
                                                                <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                                    <span className="size-1 bg-emerald-500 rounded-full shrink-0" /> {doc}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
                                                <div className="text-xs">
                                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-medium">{t("keyBenefit")}</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium line-clamp-1">{scheme.benefits}</span>
                                                </div>
                                                <button
                                                    onClick={() => setActiveModalScheme(scheme)}
                                                    className="flex items-center gap-1 text-xs text-emerald-400 font-medium group-hover:underline pl-2 shrink-0"
                                                    type="button"
                                                >
                                                    {t("details")} <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
                                {t("emptyState")}
                            </div>
                        )}
                    </div>
                    </>
                )}
            </div>

            {selectedSchemes.length >= 2 ? (
                <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
                    <button
                        type="button"
                        onClick={() => setIsCompareOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-emerald-950/30 hover:bg-slate-900"
                    >
                        <Scale className="size-4 text-emerald-400" />
                        {t("compareBar", { count: selectedSchemes.length })}
                    </button>
                </div>
            ) : null}

            {activeModalScheme && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-2xl p-6 relative shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setActiveModalScheme(null)}
                            className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                            type="button"
                        >
                            <X className="size-5" />
                        </button>

                        <div className="space-y-1">
                            <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-emerald-400">{activeModalScheme.category}</span>
                                <span className="text-slate-500">/</span>
                                <span className="text-blue-400">{activeModalScheme.provider}</span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6">{activeModalScheme.title}</h2>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{activeModalScheme.ministry}</p>
                        </div>

                        <hr className="border-slate-200 dark:border-slate-800" />

                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block uppercase tracking-wider mb-0.5">{t("overview")}</span>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/40">{activeModalScheme.description}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="p-3 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/40">
                                    <span className="text-xs font-semibold text-emerald-400 block uppercase tracking-wider mb-0.5">{t("financialBenefits")}</span>
                                    <p className="text-slate-800 dark:text-slate-200 text-xs font-medium">{activeModalScheme.benefits}</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/40">
                                    <span className="text-xs font-semibold text-blue-400 block uppercase tracking-wider mb-0.5">{t("eligibilityProfile")}</span>
                                    <p className="text-slate-800 dark:text-slate-200 text-xs font-medium">{activeModalScheme.eligibility}</p>
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block uppercase tracking-wider mb-1">{t("requiredDocuments")}</span>
                                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 p-3 rounded-xl grid gap-2 sm:grid-cols-2">
                                    {activeModalScheme.required_documents?.map((doc, i) => (
                                        <div key={i} className="text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                            <FileText className="size-3 text-emerald-400" /> {doc}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button
                                onClick={() => setActiveModalScheme(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                                type="button"
                            >
                                {t("closeDetails")}
                            </button>
                            <a
                                href={activeModalScheme.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-slate-900 dark:text-white text-center hover:bg-emerald-500 transition-colors inline-flex items-center justify-center gap-1.5 shadow-md"
                            >
                                {t("officialPortal")}
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {isCompareOpen ? (
                <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm p-0 sm:items-center sm:p-4">
                    <div className="w-full max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                                <Scale className="size-5 text-emerald-400" /> {t("comparisonTitle")}
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSchemes([]);
                                        setIsCompareOpen(false);
                                    }}
                                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-500"
                                >
                                    {t("clearComparison")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCompareOpen(false)}
                                    className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selectedSchemes.length}, minmax(0, 1fr))` }}>
                            {selectedSchemes.map((scheme) => {
                                const deadline = getDeadlineDisplay(scheme.end_date ?? "");
                                return (
                                    <div key={scheme.id} className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                                        <h3 className="mb-3 text-sm font-bold leading-snug text-emerald-400">{scheme.title}</h3>
                                        {[
                                            [t("compareCategory"), scheme.category],
                                            [t("compareProvider"), scheme.provider],
                                            [t("compareMinistry"), scheme.ministry],
                                            [t("compareBenefits"), scheme.benefits],
                                            [t("compareEligibility"), scheme.eligibility],
                                            [t("compareDeadline"), deadline.urgency === "hidden" ? "-" : deadline.label],
                                            [t("compareDocuments"), scheme.required_documents?.join(", ") || "-"]
                                        ].map(([label, value]) => (
                                            <div key={label} className="border-t border-slate-100 dark:border-slate-800 py-2">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                                                <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
