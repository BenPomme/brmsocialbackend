import { LegalDoc } from "@/components/LegalDoc";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Encargo de tratamiento · BabyRock" };

export default function DpaPage() {
  return <LegalDoc id="encargo" />;
}
