import { loadPublicStats } from "../../../lib/public-stats-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const stats = await loadPublicStats();
    const fresh = new URL(request.url).searchParams.has("fresh");
    return Response.json(stats, {
      headers: {
        "Cache-Control": fresh ? "no-store" : "public, max-age=0, s-maxage=5, must-revalidate"
      }
    });
  } catch (error) {
    console.error("public-stats: aggregate unavailable", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
