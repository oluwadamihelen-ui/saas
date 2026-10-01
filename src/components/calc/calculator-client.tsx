"use client";
import { Calculator, type CalcInitial, type SavedSpecs } from "@/components/calc/calculator";
import { saveCalculationAction, saveSpecAction } from "@/actions/calc";
import type { RiskBands } from "@/lib/engine/risk";

/** Binds the server actions so the (server) page can render the client calculator. */
export function AppCalculator(props: { mode: "size" | "risk"; currency: string; initial?: CalcInitial; savedSpecs: SavedSpecs; maxRiskPerTrade: number; bands: RiskBands }) {
  return <Calculator {...props} onSave={saveCalculationAction} onSaveSpec={saveSpecAction} showJournalLink />;
}
