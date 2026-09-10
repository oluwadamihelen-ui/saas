"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBookAction, issueLoanAction, type LibraryFormState } from "./actions";

const initialState: LibraryFormState = { status: "idle" };

export function AddBookForm() {
  const [state, formAction, isPending] = useActionState(createBookAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required placeholder="Things Fall Apart" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="author">Author</Label>
          <Input id="author" name="author" required placeholder="Chinua Achebe" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="isbn">ISBN (optional)</Label>
          <Input id="isbn" name="isbn" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category (optional)</Label>
          <Input id="category" name="category" placeholder="Fiction" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="totalCopies">Copies</Label>
          <Input id="totalCopies" name="totalCopies" type="number" min={1} defaultValue={1} required />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add book"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function IssueLoanForm({
  books,
  students,
  staff,
}: {
  books: { id: string; title: string; availableCopies: number }[];
  students: { id: string; firstName: string; lastName: string; admissionNumber: string }[];
  staff: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(issueLoanAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [borrowerType, setBorrowerType] = useState<"student" | "staff">("student");
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const inTwoWeeks = dueDate.toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bookId">Book</Label>
          <Select id="bookId" name="bookId" required defaultValue="">
            <option value="" disabled>Select book</option>
            {books.filter((b) => b.availableCopies > 0).map((b) => (
              <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} available)</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueAt">Due date</Label>
          <Input id="dueAt" name="dueAt" type="date" required defaultValue={inTwoWeeks} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="borrowerType">Borrower type</Label>
          <Select
            id="borrowerType"
            name="borrowerType"
            value={borrowerType}
            onChange={(e) => setBorrowerType(e.target.value as "student" | "staff")}
          >
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="borrowerId">Borrower</Label>
          <Select id="borrowerId" name="borrowerId" required defaultValue="">
            <option value="" disabled>Select {borrowerType === "student" ? "student" : "staff member"}</option>
            {borrowerType === "student"
              ? students.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                ))
              : staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Issuing..." : "Issue loan"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">Loan issued.</p>}
    </form>
  );
}
