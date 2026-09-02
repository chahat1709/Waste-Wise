import { z } from "zod";

const geocodeRequestSchema = z.object({
  address: z.string().trim().min(5).max(300),
});

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

const resultCache = new Map<string, { latitude: number; longitude: number; displayName: string } | null>();
const requestWindows = new Map<string, { count: number; resetsAt: number }>();
let nextNominatimRequestAt = 0;

function clientIdentifier(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-showcase";
}

function allowRequest(request: Request) {
  const id = clientIdentifier(request);
  const now = Date.now();
  const current = requestWindows.get(id);
  if (!current || current.resetsAt <= now) {
    requestWindows.set(id, { count: 1, resetsAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  return true;
}

async function waitForNominatimSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, nextNominatimRequestAt - now);
  nextNominatimRequestAt = Math.max(now, nextNominatimRequestAt) + 1100;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export async function POST(request: Request) {
  if (!allowRequest(request)) {
    return Response.json(
      { error: { code: "rate_limited", message: "Please wait before searching for more locations." } },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = geocodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_address", message: "Enter a complete bin address before locating it." } },
      { status: 400 },
    );
  }

  const address = parsed.data.address;
  const query = /ahmedabad/i.test(address) ? address : `${address}, Ahmedabad, Gujarat, India`;
  const cacheKey = query.toLocaleLowerCase("en-IN");

  if (resultCache.has(cacheKey)) {
    const cached = resultCache.get(cacheKey);
    return Response.json({ result: cached }, { headers: { "Cache-Control": "private, max-age=86400" } });
  }

  await waitForNominatimSlot();
  const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("limit", "1");
  searchUrl.searchParams.set("countrycodes", "in");

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Waste-Wise-Ahmedabad-Showcase/1.0 (prototype geocoding)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        { error: { code: "geocoder_unavailable", message: "The map search service is unavailable. Enter coordinates manually or try again." } },
        { status: 503 },
      );
    }

    const results = await response.json() as NominatimResult[];
    const firstResult = results[0];
    const latitude = Number(firstResult?.lat);
    const longitude = Number(firstResult?.lon);
    const result = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude, displayName: firstResult.display_name }
      : null;

    resultCache.set(cacheKey, result);
    return Response.json({ result }, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch {
    return Response.json(
      { error: { code: "geocoder_unavailable", message: "The map search service is unavailable. Enter coordinates manually or try again." } },
      { status: 503 },
    );
  }
}
