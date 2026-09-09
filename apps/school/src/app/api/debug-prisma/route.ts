import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

/// Temporary diagnostic route — direct ground truth about what's actually
/// on disk in the deployed serverless function, cutting through local
/// .nft.json trace-file inference that keeps disagreeing with Vercel's
/// actual runtime behavior. Delete once the Prisma engine deployment
/// issue is resolved.
export async function GET() {
  const candidates = [
    path.join(process.cwd(), "src/generated/prisma"),
    path.join(process.cwd(), "apps/school/src/generated/prisma"),
    path.join(__dirname, "../../../../../generated/prisma"),
  ];

  const results = candidates.map((dir) => {
    try {
      return { dir, exists: true, files: fs.readdirSync(dir) };
    } catch (error) {
      return { dir, exists: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  return NextResponse.json({
    cwd: process.cwd(),
    dirname: __dirname,
    results,
  });
}
