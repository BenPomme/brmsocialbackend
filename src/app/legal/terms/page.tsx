import { LegalDoc } from "@/components/LegalDoc";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Condiciones · BabyRock" };

export default function TermsPage() {
  return <LegalDoc id="condiciones" />;
}
