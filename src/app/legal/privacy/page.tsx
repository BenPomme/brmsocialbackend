import { LegalDoc } from "@/components/LegalDoc";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad · BabyRock" };

export default function PrivacyPage() {
  return <LegalDoc id="privacidad" />;
}
