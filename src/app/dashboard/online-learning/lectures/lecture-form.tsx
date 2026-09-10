"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export interface LectureFormState {
  status: "idle" | "error";
  message?: string;
}

const RESOURCE_TYPES = [
  { value: "VIDEO", label: "Video lecture" },
  { value: "AUDIO", label: "Audio lecture" },
  { value: "WRITTEN", label: "Written lesson" },
  { value: "PDF", label: "PDF" },
  { value: "WORD_DOCUMENT", label: "Word document" },
  { value: "PRESENTATION", label: "Presentation" },
  { value: "IMAGE", label: "Image" },
  { value: "EXTERNAL_LINK", label: "External learning resource" },
] as const;

const ACCEPT_BY_TYPE: Record<string, string> = {
  VIDEO: "video/*",
  AUDIO: "audio/*",
  PDF: "application/pdf",
  WORD_DOCUMENT: ".doc,.docx",
  PRESENTATION: ".ppt,.pptx",
  IMAGE: "image/*",
};

interface ResourceRow {
  key: string;
  type: (typeof RESOURCE_TYPES)[number]["value"];
  title: string;
  existingFileUrl?: string | null;
}

export interface LectureFormDefaults {
  subjectClassKey?: string;
  termId?: string;
  title?: string;
  topic?: string;
  description?: string;
  learningObjectives?: string;
  instructions?: string;
  dueDate?: string;
  resources?: { type: ResourceRow["type"]; title: string; fileUrl?: string | null }[];
}

export function LectureForm({
  action,
  assignments,
  terms,
  defaults,
  submitLabel,
}: {
  action: (prevState: LectureFormState, formData: FormData) => Promise<LectureFormState>;
  assignments: { subjectId: string; classArmId: string; subject: { name: string }; classArm: { name: string; classGroup: { name: string } } }[];
  terms: { id: string; name: string; academicSessionId: string; academicSession: { name: string } }[];
  defaults?: LectureFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as LectureFormState);
  const [resources, setResources] = useState<ResourceRow[]>(
    defaults?.resources?.map((r, i) => ({ key: `existing-${i}`, type: r.type, title: r.title, existingFileUrl: r.fileUrl ?? null })) ?? []
  );

  function addResource() {
    setResources((prev) => [...prev, { key: `new-${Date.now()}-${prev.length}`, type: "PDF", title: "" }]);
  }
  function removeResource(key: string) {
    setResources((prev) => prev.filter((r) => r.key !== key));
  }
  function updateResourceType(key: string, type: ResourceRow["type"]) {
    setResources((prev) => prev.map((r) => (r.key === key ? { ...r, type } : r)));
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="resourceKeys" value={resources.map((r) => r.key).join(",")} />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Lecture details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="subjectClassKey">Subject &amp; class</Label>
            <Select id="subjectClassKey" name="subjectClassKey" required defaultValue={defaults?.subjectClassKey ?? ""}>
              <option value="" disabled>
                Select subject and class
              </option>
              {assignments.map((a) => (
                <option key={`${a.subjectId}|${a.classArmId}`} value={`${a.subjectId}|${a.classArmId}`}>
                  {a.subject.name} — {a.classArm.classGroup.name} {a.classArm.name}
                </option>
              ))}
            </Select>
            {assignments.length === 0 && (
              <p className="text-xs text-danger">You are not assigned to teach any subject/class yet — ask an administrator to assign you first.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="termId">Term</Label>
            <Select id="termId" name="termId" required defaultValue={defaults?.termId ?? ""}>
              <option value="" disabled>
                Select term
              </option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.academicSession.name} — {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Lecture title</Label>
          <Input id="title" name="title" required defaultValue={defaults?.title} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" name="topic" defaultValue={defaults?.topic} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due date (optional)</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={defaults?.dueDate} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" defaultValue={defaults?.description} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="learningObjectives">Learning objectives</Label>
          <Textarea id="learningObjectives" name="learningObjectives" defaultValue={defaults?.learningObjectives} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instructions">Instructions for students</Label>
          <Textarea id="instructions" name="instructions" defaultValue={defaults?.instructions} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Content &amp; attachments</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addResource}>
            <Plus className="h-4 w-4" /> Add resource
          </Button>
        </div>
        {resources.length === 0 && <p className="text-sm text-muted">No content added yet — add a video, document or written lesson below.</p>}
        <div className="space-y-4">
          {resources.map((r) => (
            <div key={r.key} className="space-y-3 rounded-md border border-border p-4">
              <input type="hidden" name={`resource_key_${r.key}`} value={r.key} />
              {r.existingFileUrl && <input type="hidden" name={`resource_existingFileUrl_${r.key}`} value={r.existingFileUrl} />}
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`resource_type_${r.key}`}>Content type</Label>
                    <Select
                      id={`resource_type_${r.key}`}
                      name={`resource_type_${r.key}`}
                      defaultValue={r.type}
                      onChange={(e) => updateResourceType(r.key, e.target.value as ResourceRow["type"])}
                    >
                      {RESOURCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`resource_title_${r.key}`}>Title</Label>
                    <Input id={`resource_title_${r.key}`} name={`resource_title_${r.key}`} required defaultValue={r.title} />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeResource(r.key)} className="mt-6">
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>

              {r.type === "EXTERNAL_LINK" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`resource_externalUrl_${r.key}`}>Resource URL</Label>
                  <Input id={`resource_externalUrl_${r.key}`} name={`resource_externalUrl_${r.key}`} type="url" placeholder="https://" />
                </div>
              ) : r.type === "WRITTEN" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`resource_written_${r.key}`}>Lesson content</Label>
                  <Textarea id={`resource_written_${r.key}`} name={`resource_written_${r.key}`} rows={6} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={`resource_file_${r.key}`}>{r.existingFileUrl ? "Replace file (optional)" : "File"}</Label>
                  <input
                    id={`resource_file_${r.key}`}
                    name={`resource_file_${r.key}`}
                    type="file"
                    accept={ACCEPT_BY_TYPE[r.type]}
                    className="block text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                  />
                  {r.existingFileUrl && <p className="text-xs text-muted">A file is already attached — leave blank to keep it.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : submitLabel}</Button>
        <Button asChild variant="secondary" type="button">
          <Link href="/dashboard/online-learning/lectures">Cancel</Link>
        </Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
