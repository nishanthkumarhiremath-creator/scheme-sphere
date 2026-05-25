"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { Bell, Globe2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getUnreadNotificationCount } from "@/app/actions/notifications";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { type AppLocale, locales } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/navigation";

type AppHeaderProps = {
  authEnabled: boolean;
  locale: AppLocale;
  labels: {
    search: string;
    eligibility: string;
    assistant: string;
    dashboard: string;
    notifications: string;
    signIn: string;
    signUp: string;
    switchLanguage: string;
  };
};

export function AppHeader({ authEnabled, locale, labels }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pathWithoutLocale = pathname || "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link className="flex items-center gap-2 font-semibold" href="/" locale={locale}>
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Search className="size-4" />
          </span>
          <span>SchemeSphere</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "search", label: labels.search },
            { href: "eligibility", label: labels.eligibility },
            { href: "assistant", label: labels.assistant },
            { href: "dashboard", label: labels.dashboard },
            { href: "notifications", label: labels.notifications, icon: Bell }
          ].map((item) => {
            const Icon = "icon" in item ? item.icon : undefined;

            return (
              <Button asChild key={item.href} variant="ghost">
                <Link className="gap-1.5" href={`/${item.href}`} locale={locale}>
                  {Icon ? <Icon className="size-4" /> : null}
                  {item.label}
                  {item.href === "notifications" && authEnabled ? (
                    <UnreadNotificationBadge pathname={pathname} />
                  ) : null}
                </Link>
              </Button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 rounded-md border bg-background/70 p-1 sm:flex">
            <Globe2 className="ml-2 size-4 text-muted-foreground" />
            {locales.map((item) => (
              <Button
                className={cn("h-8 px-2", item === locale && "bg-accent")}
                key={item}
                onClick={() => router.replace(pathWithoutLocale, { locale: item })}
                size="sm"
                title={labels.switchLanguage}
                variant="ghost"
                type="button"
              >
                {item.toUpperCase()}
              </Button>
            ))}
          </div>
          <ThemeToggle />
          {authEnabled ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button className="hidden sm:inline-flex" variant="ghost">
                    {labels.signIn}
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button>{labels.signUp}</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl={`/${locale}`} />
              </SignedIn>
            </>
          ) : (
            <>
              <Button asChild className="hidden sm:inline-flex" variant="ghost">
                <Link href="/sign-in" locale={locale}>{labels.signIn}</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up" locale={locale}>{labels.signUp}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function UnreadNotificationBadge({ pathname }: { pathname: string }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshUnreadNotifications = useCallback(() => {
    if (!isLoaded || !isSignedIn || !user?.id) {
      setUnreadNotifications(0);
      return;
    }

    getUnreadNotificationCount(user.id)
      .then(setUnreadNotifications)
      .catch(() => setUnreadNotifications(0));
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    refreshUnreadNotifications();
  }, [pathname, refreshUnreadNotifications]);

  useEffect(() => {
    window.addEventListener(
      "schemesphere:notifications",
      refreshUnreadNotifications
    );

    return () => {
      window.removeEventListener(
        "schemesphere:notifications",
        refreshUnreadNotifications
      );
    };
  }, [refreshUnreadNotifications]);

  if (unreadNotifications === 0) {
    return null;
  }

  return (
    <span className="ml-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
      {unreadNotifications > 9 ? "9+" : unreadNotifications}
    </span>
  );
}
