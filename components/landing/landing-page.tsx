"use client";

import { motion } from "framer-motion";
import { ArrowRight, BadgeIndianRupee, Bookmark, GraduationCap, Landmark, Search, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type AppLocale } from "@/lib/i18n";
import { Link, useRouter } from "@/navigation";

type LandingPageProps = {
  locale: AppLocale;
  copy: {
    badge: string;
    headline: string;
    subheadline: string;
    searchPlaceholder: string;
    searchCta: string;
    eligibilityCta: string;
    stats: Array<{ value: string; label: string }>;
    examplesTitle: string;
    examples: string[];
    featureTitle: string;
    features: Array<{ title: string; description: string }>;
  };
};

const featureIcons = [Landmark, GraduationCap, BadgeIndianRupee, ShieldCheck];

export function LandingPage({ locale, copy }: LandingPageProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    router.push(params.size ? `/search?${params.toString()}` : "/search", {
      locale
    });
  }

  return (
    <main>
      <section className="container grid min-h-[calc(100vh-4rem)] items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/10" variant="outline">
            <Sparkles className="mr-1 size-3" />
            {copy.badge}
          </Badge>

          <div className="space-y-5">
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl lg:text-6xl">
              {copy.headline}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {copy.subheadline}
            </p>
          </div>

          <form
            className="flex w-full max-w-2xl flex-col gap-3 rounded-lg border bg-card/80 p-2 shadow-glass backdrop-blur-xl sm:flex-row"
            onSubmit={onSubmit}
          >
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-md bg-background/70 px-4">
              <Search className="size-5 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                value={query}
              />
            </label>
            <Button className="min-h-12" type="submit">
              {copy.searchCta}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {copy.examples.map((example) => (
              <Link
                className="rounded-md border bg-background/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                href={`/search?q=${encodeURIComponent(example)}`}
                key={example}
                locale={locale}
              >
                {example}
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
          initial={{ opacity: 0, scale: 0.97 }}
          transition={{ delay: 0.1, duration: 0.45 }}
        >
          <div className="rounded-lg border bg-card/70 p-4 shadow-glass backdrop-blur-xl">
            <div className="grid gap-3">
              <div className="rounded-md border bg-background/80 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{copy.examplesTitle}</p>
                    <h2 className="text-xl font-semibold tracking-normal">SchemeSphere</h2>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/eligibility" locale={locale}>{copy.eligibilityCta}</Link>
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {copy.stats.map((stat) => (
                    <div className="rounded-md border bg-card p-3" key={stat.label}>
                      <p className="text-2xl font-semibold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {copy.features.map((feature, index) => {
                const Icon = featureIcons[index] ?? Bookmark;
                return (
                  <Card className="bg-background/80" key={feature.title}>
                    <CardContent className="flex items-start gap-4 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <h3 className="font-medium">{feature.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </motion.div>
      </section>

      <section className="border-t bg-muted/30 py-12">
        <div className="container">
          <h2 className="mb-6 text-2xl font-semibold tracking-normal">{copy.featureTitle}</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {copy.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Bookmark;
              return (
                <Card className="bg-card/80 backdrop-blur-xl" key={feature.title}>
                  <CardContent className="space-y-4 p-5">
                    <Icon className="size-6 text-primary" />
                    <div>
                      <h3 className="font-medium">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
