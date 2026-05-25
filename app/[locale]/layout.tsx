import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { isClerkConfigured } from "@/lib/auth";
import { isAppLocale, locales, type AppLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function getMessages(locale: AppLocale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const messages = await getMessages(locale);
  const authEnabled = isClerkConfigured();
  const content = (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <AppHeader
          authEnabled={authEnabled}
          locale={locale}
          labels={messages.navigation}
        />
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  );

  return authEnabled ? <ClerkProvider>{content}</ClerkProvider> : content;
}
