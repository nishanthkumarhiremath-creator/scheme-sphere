"use client";

import {
  getUserNotifications,
  markUserNotificationsRead,
  type UserNotification
} from "@/app/actions/notifications";
import { useUser } from "@clerk/nextjs";
import { Bell, BellOff, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link } from "@/navigation";

function formatNotificationDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const locale = useLocale();
  const t = useTranslations("notifications");
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !user?.id) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    getUserNotifications(user.id)
      .then((items) => {
        if (isCurrent) {
          setNotifications(items);
          void markUserNotificationsRead(user.id).then(() => {
            window.dispatchEvent(new Event("schemesphere:notifications"));
          });
        }
      })
      .catch((error) => {
        console.error("Failed to load notifications:", error);
        if (isCurrent) {
          setNotifications([]);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isLoaded, isSignedIn, user?.id]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-slate-950 p-6 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Bell className="size-4" />
              {t("heading")}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t("subheading")}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("description")}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
            {t("activeAlerts", { count: notifications.length })}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-16 text-slate-600 dark:text-slate-400">
            <Loader2 className="mb-3 size-8 animate-spin text-emerald-400" />
            <p className="text-sm">{t("loading")}</p>
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                key={notification.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          {notification.category}
                        </span>
                        {!notification.readAt ? (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            {t("new")}
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock3 className="size-3" />
                          {formatNotificationDate(notification.createdAt, locale)}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {notification.title}
                      </h2>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                  {notification.link ? (
                    notification.link.startsWith("/") ? (
                      <Link
                        className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                        href={notification.link}
                        locale={locale}
                      >
                        {t("view")}
                      </Link>
                    ) : (
                      <a
                        className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                        href={notification.link}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {t("officialLink")}
                      </a>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-16 text-center">
            <BellOff className="mb-3 size-8 text-slate-600" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {t("emptyHeading")}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              {t("emptyDescription")}
            </p>
            <Link
              className="mt-5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-900 dark:text-white transition-colors hover:bg-emerald-500"
              href="/dashboard"
              locale={locale}
            >
              {t("completeProfile")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
