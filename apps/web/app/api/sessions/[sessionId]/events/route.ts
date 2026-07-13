import { prisma } from "@hindcast/db";
import { readChunkEvents } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const chunks = await prisma.eventChunk.findMany({
    where: { sessionId },
    orderBy: { seq: "asc" },
  });
  if (chunks.length === 0) {
    return Response.json({ error: "no events" }, { status: 404 });
  }

  // v1 hands the whole session over in one response; chunked/windowed
  // loading can come once sessions get long enough to hurt.
  const arrays = await Promise.all(
    chunks.map((chunk) => readChunkEvents(chunk.storageKey)),
  );

  return Response.json(
    { events: arrays.flat() },
    { headers: { "cache-control": "no-store" } },
  );
}
