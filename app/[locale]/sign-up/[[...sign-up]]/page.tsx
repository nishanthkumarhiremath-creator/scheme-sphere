import { SignUp } from "@clerk/nextjs";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isClerkConfigured } from "@/lib/auth";
import { isAppLocale } from "@/lib/i18n";

type SignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  if (!isClerkConfigured()) {
    return (
      <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
        <Card className="max-w-md bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Authentication setup required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Add Clerk keys to your environment to enable account creation for
            SchemeSphere.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
      <SignUp
        appearance={{
          elements: {
            card: "shadow-glass border border-border",
            formButtonPrimary: "bg-primary hover:bg-primary/90"
          }
        }}
        fallbackRedirectUrl={`/${locale}/dashboard`}
        signInUrl={`/${locale}/sign-in`}
      />
    </main>
  );
}
