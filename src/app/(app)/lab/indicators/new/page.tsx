import type { Metadata } from "next";
import { IndicatorForm } from "@/components/lab/forms";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Import indicator" };

export default function NewIndicator() {
  return (<><PageHeader title="Import your indicator" subtitle="Name it, paste or upload your Pine Script, review its inputs, and choose who can see it." /><IndicatorForm /></>);
}
