import { createNavigation } from "next-intl/navigation";

import { defaultLocale, locales } from "@/lib/i18n";

export const {
  Link,
  getPathname,
  redirect,
  usePathname,
  useRouter
} = createNavigation({
  defaultLocale,
  localePrefix: "always",
  locales
});
