import { defaultLocale } from "@/lib/i18n";
import { redirect } from "@/navigation";

export default function RootPage() {
  redirect({ href: "/", locale: defaultLocale });
}
