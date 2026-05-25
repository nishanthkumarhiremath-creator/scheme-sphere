import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "@/lib/i18n";

const localePattern = "(en|hi|kn|ta|te)";

const intlMiddleware = createMiddleware({
  defaultLocale,
  localePrefix: "always",
  locales
});

const isPublicRoute = createRouteMatcher([
  "/",
  `/${localePattern}`,
  `/${localePattern}/sign-in(.*)`,
  `/${localePattern}/sign-up(.*)`,
  `/${localePattern}/search(.*)`,
  `/${localePattern}/eligibility(.*)`,
  `/${localePattern}/assistant(.*)`,
  `/${localePattern}/dashboard(.*)`,
  `/${localePattern}/notifications(.*)`
]);

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname.startsWith("/api")) {
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)"
  ]
};
