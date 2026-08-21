import { handleShotGenerationRequest } from "@/lib/shotGeneration";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return handleShotGenerationRequest(params.id);
}
