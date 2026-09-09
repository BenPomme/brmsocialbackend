import { LegalDoc } from "@/components/LegalDoc";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookies · BabyRock" };

export default function CookiesPage() {
  return <LegalDoc id="cookies" />;
}
