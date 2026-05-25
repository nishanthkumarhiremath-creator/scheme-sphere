"use client";

import { getSavedBookmarks, toggleBookmark } from "@/app/actions/bookmarks";
import { getDeadlineDisplay, type DeadlineUrgency } from "@/lib/deadline";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import React, { useEffect, useRef, useState } from "react";
import {
    ArrowRight,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileText,
    Heart,
    HelpCircle,
    Loader2,
    RotateCcw,
    Sparkles
} from "lucide-react";

interface SchemeResult {
    title: string;
    provider: string;
    category: string;
    ministry: string;
    benefits: string;
    reason: string;
    link: string;
    required_documents?: string[];
    end_date?: string;
}

interface SearchAiScheme {
    title: string;
    provider: string;
    category?: string;
    ministry?: string;
    benefits: string;
    description?: string;
    link: string;
    required_documents?: string[];
    end_date?: string;
}

function makeSchemeId(title: string, link: string) {
    return `${title}-${link}`
        .toLowerCase()
        .replace(/https?:\/\//g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120);
}

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
        <div className={`flex items-center gap-0.5 border text-[9px] font-bold px-1.5 py-0.5 rounded ${deadlineClassName(display.urgency)}`}>
            <Calendar className="size-2.5" /> {display.label}
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

export default function EligibilityPage() {
    const { isLoaded, isSignedIn, user } = useUser();
    const t = useTranslations("eligibility");
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        age: "",
        gender: "Any",
        category: "General",
        state: "Karnataka",
        annualIncome: "",
        occupation: "Student"
    });

    const [results, setResults] = useState<SchemeResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [savedSchemeIds, setSavedSchemeIds] = useState<Set<string>>(new Set());
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [submitError, setSubmitError] = useState("");
    const inFlightSubmitRef = useRef(false);

    useEffect(() => {
        if (isLoaded && isSignedIn && user?.id) {
            getSavedBookmarks(user.id).then((bookmarks) => {
                setSavedSchemeIds(new Set(bookmarks.map((bookmark) => bookmark.schemeId)));
            });
        } else if (isLoaded) {
            setSavedSchemeIds(new Set());
        }
    }, [isLoaded, isSignedIn, user?.id]);

    const handleInputChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmitProfile = async () => {
        if (inFlightSubmitRef.current) {
            return;
        }

        try {
            inFlightSubmitRef.current = true;
            setSubmitError("");
            setIsLoading(true);
            setStep(4);

            const response = await fetch("/api/search-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: `Eligible Indian schemes for: age ${formData.age}, gender ${formData.gender}, category ${formData.category}, state ${formData.state}, income INR ${formData.annualIncome}, occupation ${formData.occupation}.`
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setSubmitError(typeof data?.error === "string" ? data.error : "Eligibility AI is temporarily unavailable. Please try again shortly.");
                setResults([]);
                setHasSubmitted(true);
                return;
            }

            if (Array.isArray(data)) {
                const standardResults: SchemeResult[] = (data as SearchAiScheme[]).map((item) => ({
                    title: item.title,
                    provider: item.provider,
                    category: item.category || "Welfare",
                    ministry: item.ministry || "Government Initiative",
                    benefits: item.benefits,
                    reason: item.description || `Directly matches your profile parameters as a ${formData.occupation} in ${formData.state}.`,
                    link: item.link,
                    end_date: ensureFutureDate(item.end_date),
                    required_documents: Array.isArray(item.required_documents) && item.required_documents.length > 0
                        ? item.required_documents
                        : []
                }));

                setResults(standardResults);
                setHasSubmitted(true);
            }
        } catch (error) {
            console.error("Exhaustive evaluation pipeline error:", error);
            setSubmitError("Eligibility AI is temporarily unavailable. Please try again shortly.");
            setResults([]);
            setHasSubmitted(true);
        } finally {
            inFlightSubmitRef.current = false;
            setIsLoading(false);
        }
    };

    const resetWizard = () => {
        setFormData({ age: "", gender: "Any", category: "General", state: "Karnataka", annualIncome: "", occupation: "Student" });
        setResults([]);
        setHasSubmitted(false);
        setStep(1);
        setExpandedIndex(null);
        setSubmitError("");
    };

    const handleToggleBookmark = async (scheme: SchemeResult) => {
        if (!user?.id) {
            alert(t("signInToSave"));
            return;
        }

        const schemeId = makeSchemeId(scheme.title, scheme.link);
        const result = await toggleBookmark(user.id, {
            schemeId,
            title: scheme.title,
            benefit: scheme.benefits,
            link: scheme.link
        });

        setSavedSchemeIds((current) => {
            const next = new Set(current);
            if (result.bookmarked) {
                next.add(schemeId);
            } else {
                next.delete(schemeId);
            }
            return next;
        });
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-6 flex items-center justify-center">
            <div className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 ${step === 4 && hasSubmitted ? "max-w-4xl" : "max-w-xl"
                }`}>

                {!hasSubmitted && step <= 3 && (
                    <div className="absolute top-0 left-0 w-full bg-slate-100 dark:bg-slate-800 h-1">
                        <div
                            className="bg-emerald-500 h-1 transition-all duration-300"
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>
                )}

                <div className="mb-6 space-y-1">
                    <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="size-5" /> {t("title")}
                    </h1>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        {t("subtitle")}
                    </p>
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <HelpCircle className="size-4 text-emerald-400" /> {t("step1")}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("age")}</label>
                                <input
                                    type="number"
                                    value={formData.age}
                                    onChange={(e) => handleInputChange("age", e.target.value)}
                                    placeholder={t("agePlaceholder")}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("gender")}</label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => handleInputChange("gender", e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="Any">{t("genderAny")}</option>
                                    <option value="Female">{t("genderFemale")}</option>
                                    <option value="Male">{t("genderMale")}</option>
                                    <option value="Transgender">{t("genderTransgender")}</option>
                                </select>
                            </div>
                        </div>
                        <button
                            disabled={!formData.age}
                            onClick={() => setStep(2)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-semibold py-3 rounded-xl transition-colors mt-2 flex items-center justify-center gap-1 disabled:opacity-40"
                        >
                            {t("next")} <ArrowRight className="size-3.5" />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <HelpCircle className="size-4 text-emerald-400" /> {t("step2")}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("category")}</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleInputChange("category", e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="General">{t("catGeneral")}</option>
                                    <option value="EWS">{t("catEWS")}</option>
                                    <option value="OBC">{t("catOBC")}</option>
                                    <option value="SC">{t("catSC")}</option>
                                    <option value="ST">{t("catST")}</option>
                                    <option value="Minority">{t("catMinority")}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("state")}</label>
                                <input
                                    type="text"
                                    value={formData.state}
                                    onChange={(e) => handleInputChange("state", e.target.value)}
                                    placeholder={t("statePlaceholder")}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setStep(1)} className="w-1/3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold py-3 rounded-xl transition-colors">{t("back")}</button>
                            <button onClick={() => setStep(3)} className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-1">{t("next")} <ArrowRight className="size-3.5" /></button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <HelpCircle className="size-4 text-emerald-400" /> {t("step3")}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("occupation")}</label>
                                <select
                                    value={formData.occupation}
                                    onChange={(e) => handleInputChange("occupation", e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="Student">{t("occStudent")}</option>
                                    <option value="Farmer / Agriculturist">{t("occFarmer")}</option>
                                    <option value="Women Entrepreneur">{t("occWomen")}</option>
                                    <option value="Senior Citizen">{t("occSenior")}</option>
                                    <option value="Person with Disability (PwD)">{t("occPwD")}</option>
                                    <option value="Unemployed Youth">{t("occUnemployed")}</option>
                                    <option value="Unorganized Laborer">{t("occWorker")}</option>
                                    <option value="Startup / Small MSME Merchant">{t("occStartup")}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("annualIncome")}</label>
                                <input
                                    type="number"
                                    value={formData.annualIncome}
                                    onChange={(e) => handleInputChange("annualIncome", e.target.value)}
                                    placeholder={t("incomePlaceholder")}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setStep(2)} className="w-1/3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold py-3 rounded-xl transition-colors">{t("back")}</button>
                            <button
                                disabled={!formData.annualIncome}
                                onClick={handleSubmitProfile}
                                className="w-2/3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-900 dark:text-white text-xs font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md"
                            >
                                {t("checkEligibility")}
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-4 w-full">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                <Loader2 className="size-9 text-emerald-400 animate-spin" />
                                <p className="text-sm text-slate-600 dark:text-slate-400 animate-pulse font-medium">{t("loading")}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {submitError ? (
                                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
                                        {submitError}
                                    </div>
                                ) : null}
                                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle2 className="size-5" /> {t("resultsHeader", { count: results.length })}
                                    </h2>
                                    <button
                                        onClick={resetWizard}
                                        className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw className="size-3" /> {t("reset")}
                                    </button>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {results.length > 0 ? (
                                        results.map((result, idx) => {
                                            const isExpanded = expandedIndex === idx;
                                            const schemeId = makeSchemeId(result.title, result.link);

                                            return (
                                                <div
                                                    key={schemeId}
                                                    className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 pt-8"
                                                >
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-start w-full gap-2">
                                                            <div className="truncate max-w-[60%] space-y-1">
                                                                <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
                                                                    {result.ministry}
                                                                </p>
                                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                                                                        {result.category}
                                                                    </span>
                                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                                                                        {result.provider}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <DeadlineBadge endDate={result.end_date} />
                                                                <button
                                                                    aria-label={savedSchemeIds.has(schemeId) ? t("removeSaved") : t("saveScheme")}
                                                                    className={`rounded-lg border p-1.5 transition-colors ${savedSchemeIds.has(schemeId)
                                                                        ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400"
                                                                        }`}
                                                                    onClick={() => handleToggleBookmark(result)}
                                                                    type="button"
                                                                >
                                                                    <Heart className={`size-3.5 ${savedSchemeIds.has(schemeId) ? "fill-current" : ""}`} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug">
                                                            {result.title}
                                                        </h3>
                                                        <p className="text-[11px] font-semibold text-rose-500">
                                                            Application Ends: {formatApplicationEndDate(result.end_date)}
                                                        </p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1 line-clamp-3">
                                                            {result.reason}
                                                        </p>
                                                    </div>

                                                    <div className="space-y-2 mt-2">
                                                        <div className="border-t border-slate-100 dark:border-slate-800/60 pt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                                                                className="w-full flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                            >
                                                                <span className="flex items-center gap-1">
                                                                    <FileText className="size-3 text-emerald-400" /> {t("documentsNeeded")}
                                                                </span>
                                                                {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                                            </button>

                                                            {isExpanded && (
                                                                <div className="mt-1.5 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                                                    <ul className="space-y-0.5">
                                                                        {result.required_documents?.map((doc, i) => (
                                                                            <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                                                <span className="size-1 bg-emerald-500 rounded-full" /> {doc}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/50 flex justify-between items-center gap-2">
                                                            <div className="text-[11px]">
                                                                <span className="text-slate-500 block text-[9px] uppercase font-semibold">{t("keyBenefit")}</span>
                                                                <span className="text-emerald-400 font-medium line-clamp-1">{result.benefits}</span>
                                                            </div>
                                                            <a
                                                                href={result.link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-semibold text-emerald-500 hover:underline shrink-0"
                                                            >
                                                                {t("portal")}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-full text-center py-16 text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                            {t("emptyState")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
