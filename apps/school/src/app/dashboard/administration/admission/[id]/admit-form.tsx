"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { admitApplicantAction, type AdmissionActionState } from "../actions";

const initialState: AdmissionActionState = { status: "idle" };

export function AdmitForm({
  applicantId,
  classArms,
}: {
  applicantId: string;
  classArms: { id: string; name: string; classGroup: { name: string } }[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(admitApplicantAction, initialState);

  useEffect(() => {
    if (state.status === "success") router.push("/dashboard/students");
  }, [state.status, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicantId" value={applicantId} />
      <div className="space-y-1.5">
        <Label htmlFor="classArmId">Assign to class (optional)</Label>
        <Select id="classArmId" name="classArmId" defaultValue="">
          <option value="">Unassigned for now</option>
          {classArms.map((c) => <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>)}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Admitting..." : "Complete Full Admission Process"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
