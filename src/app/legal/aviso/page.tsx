import { LegalDoc } from "@/components/LegalDoc";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso legal · BabyRock" };

export default function AvisoPage() {
  return <LegalDoc id="aviso" />;
}
