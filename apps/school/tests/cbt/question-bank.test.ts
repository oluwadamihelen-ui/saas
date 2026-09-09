import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  createQuestion,
  listQuestions,
  getQuestion,
  archiveQuestion,
  deleteQuestion,
  parseImportCsv,
  type QuestionInput,
} from "@/lib/services/cbt-questions";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchoolWithSubjectAndUser() {
  counter += 1;
  const slug = `vitest-cbt-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const user = await prisma.user.create({
    data: {
      schoolId: school.id,
      roleId: role.id,
      email: `${slug}@vitest.local`,
      passwordHash: "x",
      name: "Test Teacher",
    },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  return { school, user, subject };
}

const baseMcq: Omit<QuestionInput, "subjectId"> = {
  type: "MULTIPLE_CHOICE",
  difficulty: "EASY",
  prompt: "What is 2 + 2?",
  marks: 1,
  options: [
    { text: "3", isCorrect: false },
    { text: "4", isCorrect: true },
  ],
  tagNames: ["arithmetic"],
};

describe("CBT question bank validation", () => {
  it("rejects a multiple-choice question with zero correct options", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    await expect(
      createQuestion(school.id, user.id, {
        ...baseMcq,
        subjectId: subject.id,
        options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: false }],
      })
    ).rejects.toThrow(/one option/i);
  });

  it("rejects a multiple-choice question with more than one correct option", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    await expect(
      createQuestion(school.id, user.id, {
        ...baseMcq,
        subjectId: subject.id,
        options: [{ text: "3", isCorrect: true }, { text: "4", isCorrect: true }],
      })
    ).rejects.toThrow(/exactly one/i);
  });

  it("allows multiple correct options for MULTIPLE_SELECT", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    const question = await createQuestion(school.id, user.id, {
      ...baseMcq,
      subjectId: subject.id,
      type: "MULTIPLE_SELECT",
      options: [
        { text: "Even", isCorrect: true },
        { text: "4", isCorrect: true },
        { text: "Odd", isCorrect: false },
      ],
    });
    expect(question.status).toBe("APPROVED");
  });

  it("requires at least one accepted answer for SHORT_ANSWER", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    await expect(
      createQuestion(school.id, user.id, {
        subjectId: subject.id,
        type: "SHORT_ANSWER",
        difficulty: "MEDIUM",
        prompt: "Capital of Nigeria?",
        marks: 2,
        options: [],
        tagNames: [],
        acceptedAnswers: [],
      })
    ).rejects.toThrow(/accepted answer/i);
  });

  it("a manually created question is immediately APPROVED and self-approved", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    const question = await createQuestion(school.id, user.id, { ...baseMcq, subjectId: subject.id });
    expect(question.status).toBe("APPROVED");
    expect(question.source).toBe("MANUAL");
    expect(question.approvedById).toBe(user.id);
  });
});

describe("CBT question bank tenant isolation", () => {
  it("school A can never see school B's questions via listQuestions or getQuestion", async () => {
    const a = await makeSchoolWithSubjectAndUser();
    const b = await makeSchoolWithSubjectAndUser();

    const questionB = await createQuestion(b.school.id, b.user.id, { ...baseMcq, subjectId: b.subject.id });

    const { questions } = await listQuestions(a.school.id, {});
    expect(questions.find((q) => q.id === questionB.id)).toBeUndefined();

    expect(await getQuestion(a.school.id, questionB.id)).toBeNull();
    expect(await getQuestion(b.school.id, questionB.id)).not.toBeNull();
  });
});

describe("CBT question bank archive/delete lifecycle", () => {
  it("archived questions are hidden from the default list but visible with an explicit status filter", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    const question = await createQuestion(school.id, user.id, { ...baseMcq, subjectId: subject.id });

    await archiveQuestion(school.id, question.id);

    const { questions: defaultView } = await listQuestions(school.id, {});
    expect(defaultView.find((q) => q.id === question.id)).toBeUndefined();

    const { questions: archivedView } = await listQuestions(school.id, { status: "ARCHIVED" });
    expect(archivedView.find((q) => q.id === question.id)).toBeDefined();
  });

  it("refuses to hard-delete an APPROVED question but allows deleting a DRAFT one", async () => {
    const { school, user, subject } = await makeSchoolWithSubjectAndUser();
    const approved = await createQuestion(school.id, user.id, { ...baseMcq, subjectId: subject.id });
    await expect(deleteQuestion(school.id, approved.id)).rejects.toThrow(/draft/i);

    const draft = await prisma.cBTQuestion.create({
      data: {
        schoolId: school.id,
        subjectId: subject.id,
        type: "ESSAY",
        status: "DRAFT",
        source: "AI_GENERATED",
        difficulty: "MEDIUM",
        prompt: "Explain photosynthesis.",
        marks: 5,
        createdById: user.id,
      },
    });
    await deleteQuestion(school.id, draft.id);
    expect(await prisma.cBTQuestion.findUnique({ where: { id: draft.id } })).toBeNull();
  });
});

describe("CBT CSV import parsing", () => {
  it("parses a valid row and flags a row with an unknown subject code", async () => {
    const { school } = await makeSchoolWithSubjectAndUser();
    const csv = [
      "subjectcode,type,difficulty,topic,prompt,marks,option1,option1correct,option2,option2correct",
      'MTH,MULTIPLE_CHOICE,EASY,Numbers,"What is 5 - 3?",1,1,false,2,true',
      'ZZZ,MULTIPLE_CHOICE,EASY,Numbers,"Unknown subject",1,1,false,2,true',
    ].join("\n");

    const { rows, validCount } = await parseImportCsv(school.id, csv);
    expect(rows).toHaveLength(2);
    expect(validCount).toBe(1);
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[1].errors.some((e) => /subject/i.test(e))).toBe(true);
  });

  it("flags a row with the wrong number of correct options for its type", async () => {
    const { school } = await makeSchoolWithSubjectAndUser();
    const csv = [
      "subjectcode,type,difficulty,topic,prompt,marks,option1,option1correct,option2,option2correct",
      'MTH,MULTIPLE_CHOICE,EASY,Numbers,"Two correct options",1,1,true,2,true',
    ].join("\n");

    const { rows } = await parseImportCsv(school.id, csv);
    expect(rows[0].data).toBeNull();
    expect(rows[0].errors.some((e) => /exactly one/i.test(e))).toBe(true);
  });

  it("handles a quoted field containing a comma", async () => {
    const { school } = await makeSchoolWithSubjectAndUser();
    const csv = [
      "subjectcode,type,difficulty,topic,prompt,marks,option1,option1correct,option2,option2correct",
      'MTH,MULTIPLE_CHOICE,EASY,Numbers,"What is 1, plus 1?",1,1,false,2,true',
    ].join("\n");

    const { rows } = await parseImportCsv(school.id, csv);
    expect(rows[0].data?.prompt).toBe("What is 1, plus 1?");
  });
});
