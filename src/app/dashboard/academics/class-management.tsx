"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActionToast } from "@/hooks/use-action-toast";
import { useSafeAction } from "@/hooks/use-safe-action";
import {
  createClassGroupAction,
  createClassArmAction,
  deleteClassArmAction,
  deleteClassGroupAction,
  type ClassFormState,
} from "./actions";

const initialState: ClassFormState = { status: "idle" };

interface ClassArmData {
  id: string;
  name: string;
  _count: { students: number };
}

interface ClassGroupData {
  id: string;
  name: string;
  arms: ClassArmData[];
}

export function AddClassForm() {
  const [state, formAction, isPending] = useActionState(createClassGroupAction, initialState);
  useActionToast(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="className">Class name</Label>
        <Input id="className" name="name" required placeholder="e.g. Primary 7" />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add class"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function ClassGroupCard({ classGroup }: { classGroup: ClassGroupData }) {
  const router = useRouter();
  const [showAddArm, setShowAddArm] = useState(false);
  const action = createClassArmAction.bind(null, classGroup.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [deleteGroupPending, runDeleteGroup] = useSafeAction();
  const [deletingArmId, setDeletingArmId] = useState<string | null>(null);
  const [deleteArmPending, runDeleteArm] = useSafeAction();

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setShowAddArm(false);
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">{classGroup.name}</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddArm((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add arm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={deleteGroupPending || classGroup.arms.length > 0}
            title={classGroup.arms.length > 0 ? "Delete all arms first" : undefined}
            onClick={() =>
              runDeleteGroup(async () => {
                await deleteClassGroupAction(classGroup.id);
                router.refresh();
              })
            }
          >
            Delete class
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {classGroup.arms.map((arm) => (
          <span key={arm.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm">
            <Badge variant="neutral">
              {arm.name} · {arm._count.students} student{arm._count.students === 1 ? "" : "s"}
            </Badge>
            <button
              type="button"
              disabled={deleteArmPending && deletingArmId === arm.id}
              aria-label={`Delete ${classGroup.name} ${arm.name}`}
              onClick={() => {
                setDeletingArmId(arm.id);
                runDeleteArm(async () => {
                  await deleteClassArmAction(arm.id);
                  router.refresh();
                });
              }}
              className="text-muted hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {classGroup.arms.length === 0 && <p className="text-xs text-muted">No arms — add one to enroll students here.</p>}
      </div>

      {showAddArm && (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
          <div className="w-32 space-y-1">
            <Label htmlFor={`arm-${classGroup.id}`}>Arm name</Label>
            <Input id={`arm-${classGroup.id}`} name="name" required placeholder="e.g. B" maxLength={50} />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddArm(false)}>
            Cancel
          </Button>
          {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
        </form>
      )}
    </div>
  );
}
