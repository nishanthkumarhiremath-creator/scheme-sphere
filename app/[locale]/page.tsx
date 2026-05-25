import { LandingPage } from "@/components/landing/landing-page";
import { isAppLocale, type AppLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

async function getMessages(locale: AppLocale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const messages = await getMessages(locale);

  return <LandingPage copy={messages.landing} locale={locale} />;
}
