"use client";

import { getSavedBookmarks, toggleBookmark } from '@/app/actions/bookmarks';
import { saveUserProfile, getUserProfile } from '@/app/actions/profile';
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from '@/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
    User,
    Bookmark,
    Bell,
    Trash2,
    ShieldCheck,
    Globe,
    UserCheck,
    FolderHeart,
    X,
    Save,
    FileText,
    CheckCircle2,
    Printer
} from 'lucide-react';

interface SavedScheme {
    id: string;
    schemeId: string;
    title: string;
    benefit: string;
    link: string;
}

// Dynamic checklist — fetches required documents from AI on first open.
// Bookmark DB stores no required_documents column so we fetch lazily per scheme.
function SavedSchemeItem({ scheme, onRemove }: { scheme: SavedScheme; onRemove: (s: SavedScheme) => void }) {
    const t = useTranslations('dashboard');
    const [isSlideOpen, setIsSlideOpen] = useState(false);
    const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
    const [docs, setDocs] = useState<string[]>([]);
    const [isFetchingDocs, setIsFetchingDocs] = useState(false);
    const [docsFetched, setDocsFetched] = useState(false);
    const [activeStage, setActiveStage] = useState(0);
    const stages = [
        t('stageCollectDocuments'),
        t('stageFillForm'),
        t('stageSubmit'),
        t('stageAwaitingResult')
    ];

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const stored = window.localStorage.getItem(`schemesphere:stage:${scheme.schemeId}`);
        if (stored !== null) {
            const parsed = Number(stored);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed < stages.length) {
                setActiveStage(parsed);
            }
        }
    }, [scheme.schemeId, stages.length]);

    const handleStageClick = (stageIndex: number) => {
        setActiveStage(stageIndex);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(`schemesphere:stage:${scheme.schemeId}`, String(stageIndex));
        }
    };

    const handleToggleChecklist = async () => {
        const willOpen = !isSlideOpen;
        setIsSlideOpen(willOpen);

        // Only fetch once, the first time the drawer opens
        if (willOpen && !docsFetched) {
            setIsFetchingDocs(true);
            try {
                const res = await fetch('/api/search-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `What are the required documents for applying to this Indian government scheme: "${scheme.title}"? List only 4 to 6 specific documents.`
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].required_documents) && data[0].required_documents.length > 0) {
                        setDocs(data[0].required_documents);
                    } else {
                        setDocs(['Aadhaar Card', 'Income Certificate', 'Bank Passbook (first page)', 'Passport Size Photograph', 'Residence Proof / Domicile Certificate']);
                    }
                }
            } catch {
                setDocs(['Aadhaar Card', 'Income Certificate', 'Bank Passbook (first page)', 'Passport Size Photograph', 'Residence Proof / Domicile Certificate']);
            } finally {
                setIsFetchingDocs(false);
                setDocsFetched(true);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 min-w-0">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-snug">{scheme.title}</h3>
                    <p className="text-xs text-emerald-400 font-medium">{scheme.benefit}</p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60 shrink-0">
                    <a
                        href={scheme.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 hover:text-emerald-400 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                        Official Link ↗
                    </a>
                    <button
                        onClick={() => onRemove(scheme)}
                        className="p-2 text-slate-500 hover:text-rose-400 bg-white dark:bg-slate-950/40 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 hover:border-rose-500/20 rounded-lg transition-colors"
                        aria-label="Remove saved scheme"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Document checklist — fetches from AI on first open */}
            <div className="border-t border-slate-100 dark:border-slate-800/50 pt-2">
                <button
                    type="button"
                    onClick={handleToggleChecklist}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-emerald-400 uppercase tracking-wider transition-colors"
                >
                    <FileText className="size-3 text-emerald-400" />
                    {isSlideOpen ? t('hideRequiredDocuments') : t('trackRequiredDocuments')}
                </button>

                {isSlideOpen && (
                    <div className="mt-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-2">
                        {isFetchingDocs ? (
                            <div className="flex items-center gap-2 py-2 text-[11px] text-slate-500">
                                <svg className="animate-spin size-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                {t('fetchingDocuments')}
                            </div>
                        ) : docs.length > 0 ? (
                            <>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight">
                                    {t('checkOffDocuments')}
                                </p>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                    {docs.map((doc, idx) => (
                                        <label
                                            key={idx}
                                            className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer select-none transition-colors ${checkedDocs[doc]
                                                    ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-800 dark:text-slate-200'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!!checkedDocs[doc]}
                                                onChange={() => setCheckedDocs(prev => ({ ...prev, [doc]: !prev[doc] }))}
                                                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 size-3.5 accent-emerald-500"
                                            />
                                            <span className={checkedDocs[doc] ? 'line-through opacity-60 text-emerald-400' : ''}>{doc}</span>
                                        </label>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-[11px] text-slate-400 italic py-1">{t('noDocumentsFound')}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/50 pt-2">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('applicationProgress')}</p>
                <div className="flex flex-wrap items-center gap-2">
                    {stages.map((stage, index) => {
                        const isComplete = index < activeStage;
                        const isActive = index === activeStage;

                        return (
                            <button
                                key={stage}
                                type="button"
                                onClick={() => handleStageClick(index)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${isActive
                                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                                        : isComplete
                                            ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-700 dark:text-slate-300'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500'
                                    }`}
                            >
                                {isComplete ? <CheckCircle2 className="size-3 text-emerald-400" /> : null}
                                {stage}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { isLoaded, isSignedIn, user } = useUser();
    const router = useRouter();
    const pathname = usePathname();
    const currentLocale = useLocale();
    const t = useTranslations('dashboard');

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextLocale = e.target.value.toLowerCase();
        router.replace(pathname, { locale: nextLocale });
    };

    const [isProfileCompleted, setIsProfileCompleted] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [userMeta, setUserMeta] = useState({
        age: "",
        gender: "Any",
        category: "",
        occupation: "",
        state: "",
        incomeLimit: ""
    });

    const [formInputs, setFormInputs] = useState({
        age: "",
        gender: "Any",
        category: "General",
        occupation: "Student",
        state: "Karnataka",
        incomeLimit: "Under ₹2.5 LPA"
    });

    const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>([]);

    useEffect(() => {
        if (isLoaded && isSignedIn && user?.id) {
            getSavedBookmarks(user.id).then((bookmarks) => {
                setSavedSchemes(bookmarks);
            });

            getUserProfile(user.id).then((profile) => {
                if (profile) {
                    const parsed = {
                        age: profile.age?.toString() ?? "",
                        gender: profile.gender ?? "Any",
                        category: profile.category,
                        occupation: profile.occupation,
                        state: profile.state,
                        incomeLimit: profile.incomeLimit
                    };
                    setUserMeta(parsed);
                    setFormInputs(parsed);
                    setIsProfileCompleted(true);
                }
            });
        } else if (isLoaded) {
            setSavedSchemes([]);
        }
    }, [isLoaded, isSignedIn, user?.id]);

    const handleOpenForm = () => {
        setFormInputs({ ...userMeta });
        setIsFormOpen(true);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.id) {
            alert("Authentication session lost. Please log in again.");
            return;
        }

        try {
            await saveUserProfile(user.id, formInputs);
            setUserMeta(formInputs);
            setIsProfileCompleted(true);
            setIsFormOpen(false);
        } catch (error) {
            console.error("Failed to sync profile to database:", error);
        }
    };

    const handleRemoveBookmark = async (scheme: SavedScheme) => {
        if (!user?.id) {
            return;
        }

        await toggleBookmark(user.id, {
            schemeId: scheme.schemeId,
            title: scheme.title,
            benefit: scheme.benefit,
            link: scheme.link
        });

        setSavedSchemes((current) =>
            current.filter((item) => item.schemeId !== scheme.schemeId)
        );
    };

    const handlePrintSavedSchemes = () => {
        if (typeof window !== 'undefined') {
            window.print();
        }
    };

    const displayUserName = isLoaded && isSignedIn && user?.fullName
        ? user.fullName
        : "Account User";

    const displayNameInitial = displayUserName.charAt(0);

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-6 relative">
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }

                    #saved-schemes-print,
                    #saved-schemes-print * {
                        visibility: visible !important;
                    }

                    #saved-schemes-print {
                        position: absolute !important;
                        inset: 0 auto auto 0 !important;
                        width: 100% !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        padding: 24px !important;
                    }

                    #saved-schemes-print button,
                    #saved-schemes-print a,
                    .print-hidden {
                        display: none !important;
                    }
                }
            `}</style>
            <div className="max-w-6xl mx-auto space-y-8">

                {/* HEADER BANNER */}
                <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-white dark:from-slate-900 to-slate-50 dark:to-slate-900/30 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl uppercase">
                            {displayNameInitial}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{displayUserName}</h1>
                            {isProfileCompleted ? (
                                <p className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-1 mt-0.5">
                                    <span>{t('category')}: <strong className="text-emerald-400 font-semibold">{userMeta.category}</strong></span>
                                    <span className="text-slate-700">•</span>
                                    <span>{t('gender')}: <strong className="text-slate-700 dark:text-slate-300 font-medium">{userMeta.gender}</strong></span>
                                    {userMeta.age ? (
                                        <>
                                            <span className="text-slate-700">•</span>
                                            <span>{t('age')}: <strong className="text-slate-700 dark:text-slate-300 font-medium">{userMeta.age}</strong></span>
                                        </>
                                    ) : null}
                                    <span className="text-slate-700">•</span>
                                    <span>{t('profile')}: <strong className="text-slate-700 dark:text-slate-300 font-medium">{userMeta.occupation}</strong></span>
                                    <span className="text-slate-700">•</span>
                                    <span>{t('region')}: <strong className="text-slate-700 dark:text-slate-300 font-medium">{userMeta.state}</strong></span>
                                </p>
                            ) : (
                                <p className="text-xs text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                                    ⚠️ {t('profileIncomplete')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
                            <Globe className="size-3.5 text-slate-600 dark:text-slate-400" />
                            <select
                                value={currentLocale.toUpperCase()}
                                onChange={handleLanguageChange}
                                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
                            >
                                <option value="EN" className="bg-white dark:bg-slate-900">English (EN)</option>
                                <option value="HI" className="bg-white dark:bg-slate-900">हिन्दी (HI)</option>
                                <option value="KN" className="bg-white dark:bg-slate-900">ಕನ್ನಡ (KN)</option>
                                <option value="TA" className="bg-white dark:bg-slate-900">தமிழ் (TA)</option>
                                <option value="TE" className="bg-white dark:bg-slate-900">తెలుగు (TE)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* GRID CONTENT */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Saved Schemes */}
                    <div id="saved-schemes-print" className="lg:col-span-2 space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <Bookmark className="size-4 text-emerald-400" /> {t('savedSchemes')} ({savedSchemes.length})
                            </h2>
                            <button
                                type="button"
                                onClick={handlePrintSavedSchemes}
                                className="print:hidden inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400"
                            >
                                <Printer className="size-3.5" />
                                {t('exportPdf')}
                            </button>
                        </div>
                        <div className="grid gap-3">
                            {savedSchemes.length > 0 ? (
                                savedSchemes.map((scheme) => (
                                    <SavedSchemeItem
                                        key={scheme.id}
                                        scheme={scheme}
                                        onRemove={handleRemoveBookmark}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                                    <FolderHeart className="size-6 text-slate-600" />
                                    <p>{t('noSavedSchemes')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SIDEBAR */}
                    <div className="print:hidden space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                    <User className="size-4 text-emerald-400" /> {t('profileCompletion')}
                                </h2>
                                <span className="text-xs font-bold text-emerald-400">{isProfileCompleted ? "100%" : "0%"}</span>
                            </div>

                            <div className="w-full bg-white dark:bg-slate-950 rounded-full h-1.5 border border-slate-200 dark:border-slate-800/80">
                                <div
                                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: isProfileCompleted ? '100%' : '0%' }}
                                />
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                                {isProfileCompleted ? t('profileCompleteMsg') : t('profileIncompleteMsg')}
                            </p>

                            <button
                                onClick={handleOpenForm}
                                className="w-full text-center bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                            >
                                <UserCheck className="size-3.5" />
                                {isProfileCompleted ? t('editProfile') : t('completeProfile')}
                            </button>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                                <Bell className="size-4 text-emerald-400" /> {t('liveAlerts')}
                            </h2>
                            <div className="space-y-2.5">
                                {isProfileCompleted ? (
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/70 flex gap-2.5 items-start">
                                        <ShieldCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                            {t('alertsActive')} <span className="text-slate-800 dark:text-slate-200 font-medium">{userMeta.state}</span> — <span className="text-emerald-400 font-medium">{userMeta.category}</span>
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-600 text-xs">
                                        {t('noAlerts')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">

                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <User className="size-4 text-emerald-400" /> {t('setupProfile')}
                            </h3>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('formAge')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={formInputs.age}
                                        onChange={(e) => setFormInputs({ ...formInputs, age: e.target.value })}
                                        placeholder="e.g. 21"
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('formGender')}</label>
                                    <select
                                        value={formInputs.gender}
                                        onChange={(e) => setFormInputs({ ...formInputs, gender: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="Any">{t('genderAny')}</option>
                                        <option value="Female">{t('genderFemale')}</option>
                                        <option value="Male">{t('genderMale')}</option>
                                        <option value="Transgender">{t('genderTransgender')}</option>
                                        <option value="Other">{t('genderOther')}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('formCategory')}</label>
                                <select
                                    value={formInputs.category}
                                    onChange={(e) => setFormInputs({ ...formInputs, category: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="General">{t('catGeneral')}</option>
                                    <option value="EWS">{t('catEWS')}</option>
                                    <option value="OBC">{t('catOBC')}</option>
                                    <option value="SC">{t('catSC')}</option>
                                    <option value="ST">{t('catST')}</option>
                                    <option value="Minority">{t('catMinority')}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('formOccupation')}</label>
                                <select
                                    value={formInputs.occupation}
                                    onChange={(e) => setFormInputs({ ...formInputs, occupation: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="Student (School/College)">{t('occStudent')}</option>
                                    <option value="Farmer / Agriculturist">{t('occFarmer')}</option>
                                    <option value="Women Entrepreneur">{t('occWomen')}</option>
                                    <option value="Person with Disability (PwD)">{t('occPwD')}</option>
                                    <option value="Unemployed Youth">{t('occUnemployed')}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('formState')}</label>
                                <input
                                    type="text"
                                    value={formInputs.state}
                                    onChange={(e) => setFormInputs({ ...formInputs, state: e.target.value })}
                                    placeholder="e.g. Karnataka"
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('formIncome')}</label>
                                <select
                                    value={formInputs.incomeLimit}
                                    onChange={(e) => setFormInputs({ ...formInputs, incomeLimit: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="Under ₹1.0 LPA">{t('income1')}</option>
                                    <option value="Under ₹2.5 LPA">{t('income2')}</option>
                                    <option value="Under ₹6.0 LPA">{t('income3')}</option>
                                    <option value="Above ₹8.0 LPA">{t('income4')}</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 mt-2"
                            >
                                <Save className="size-3.5" /> {t('saveChanges')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
