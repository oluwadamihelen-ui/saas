"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface StudentFormState {
  status: "idle" | "error";
  message?: string;
  limitReached?: boolean;
}

export interface StudentFormDefaults {
  firstName?: string;
  lastName?: string;
  otherNames?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  medicalNotes?: string | null;
  allergies?: string | null;
  emergencyContact?: string | null;
  classArmId?: string | null;
}

export function StudentForm({
  action,
  classArms,
  defaults,
  submitLabel,
  showGuardianFields,
}: {
  action: (prevState: StudentFormState, formData: FormData) => Promise<StudentFormState>;
  classArms: { id: string; name: string; classGroup: { name: string } }[];
  defaults?: StudentFormDefaults;
  submitLabel: string;
  showGuardianFields?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as StudentFormState);

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Personal information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required defaultValue={defaults?.firstName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required defaultValue={defaults?.lastName} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="otherNames">Other names</Label>
            <Input id="otherNames" name="otherNames" defaultValue={defaults?.otherNames ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={defaults?.dateOfBirth ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Select id="gender" name="gender" defaultValue={defaults?.gender ?? ""}>
              <option value="">Unspecified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="addressLine">Address</Label>
            <Input id="addressLine" name="addressLine" defaultValue={defaults?.addressLine ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" defaultValue={defaults?.state ?? ""} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Academic</h3>
        <div className="space-y-1.5">
          <Label htmlFor="classArmId">Class</Label>
          <Select id="classArmId" name="classArmId" defaultValue={defaults?.classArmId ?? ""}>
            <option value="">Unassigned</option>
            {classArms.map((arm) => (
              <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
            ))}
          </Select>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Health</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bloodGroup">Blood group</Label>
            <Input id="bloodGroup" name="bloodGroup" placeholder="O+" defaultValue={defaults?.bloodGroup ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Input id="emergencyContact" name="emergencyContact" defaultValue={defaults?.emergencyContact ?? ""} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allergies">Allergies</Label>
          <Textarea id="allergies" name="allergies" defaultValue={defaults?.allergies ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="medicalNotes">Medical notes</Label>
          <Textarea id="medicalNotes" name="medicalNotes" defaultValue={defaults?.medicalNotes ?? ""} />
        </div>
      </section>

      {showGuardianFields && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Parent / guardian (optional)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="guardianFirstName">First name</Label>
              <Input id="guardianFirstName" name="guardianFirstName" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardianLastName">Last name</Label>
              <Input id="guardianLastName" name="guardianLastName" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="guardianPhone">Phone</Label>
              <Input id="guardianPhone" name="guardianPhone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardianEmail">Email</Label>
              <Input id="guardianEmail" name="guardianEmail" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardianRelationship">Relationship</Label>
              <Select id="guardianRelationship" name="guardianRelationship" defaultValue="">
                <option value="">Select</option>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || state.limitReached}>{isPending ? "Saving..." : submitLabel}</Button>
        {state.status === "error" && !state.limitReached && <p className="text-sm text-danger">{state.message}</p>}
      </div>
      {state.status === "error" && state.limitReached && (
        <div className="rounded-md border border-warning-soft bg-warning-soft p-4">
          <p className="text-sm font-medium text-foreground">{state.message}</p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/billing">Upgrade Plan</Link>
          </Button>
        </div>
      )}
    </form>
  );
}
