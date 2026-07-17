import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawMarket = {
  id?: string;
  question?: string;
  groupItemTitle?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  volume?: string | number;
  volumeNum?: number;
  volume24hr?: number;
  closed?: boolean;
  active?: boolean;
};

type RawEvent = {
  id?: string;
  title?: string;
  slug?: string;
  image?: string;
  icon?: string;
  volume?: number | string;
  volume24hr?: number | string;
  liquidity?: number | string;
  openInterest?: number | string;
  markets?: RawMarket[];
  endDate?: string;
};

type OutcomeView = {
  name: string;
  price: number;
};

type MarketView = {
  id: string;
  question: string;
  outcomes: OutcomeView[];
  volume: number;
};

type EventView = {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  volume24hr: number;
  volume: number;
  liquidity: number;
  endDate: string | null;
  markets: MarketView[];
  url: string;
};

function parseJsonField<T>(value: string | T | undefined): T | null {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMarket(market: RawMarket): MarketView | null {
  if (market.closed === true || market.active === false) return null;

  const names = parseJsonField<string[]>(market.outcomes) ?? [];
  const pricesRaw = parseJsonField<string[]>(market.outcomePrices) ?? [];
  if (!names.length || !pricesRaw.length) return null;

  const outcomes: OutcomeView[] = names.map((name, index) => ({
    name,
    price: Math.max(0, Math.min(1, toNumber(pricesRaw[index]))),
  }));

  const hasLivePrice = outcomes.some((o) => o.price > 0.01 && o.price < 0.99);
  if (!hasLivePrice) return null;

  return {
    id: String(market.id ?? ""),
    question:
      market.question?.trim() ||
      market.groupItemTitle?.trim() ||
      "Market",
    outcomes,
    volume: toNumber(market.volumeNum ?? market.volume ?? market.volume24hr),
  };
}

function normalizeEvent(event: RawEvent): EventView | null {
  const title = event.title?.trim();
  const slug = event.slug?.trim();
  if (!title || !slug) return null;

  const markets = (event.markets ?? [])
    .map(normalizeMarket)
    .filter((m): m is MarketView => Boolean(m))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  if (!markets.length) return null;

  return {
    id: String(event.id ?? slug),
    title,
    slug,
    image: event.image || event.icon || null,
    volume24hr: toNumber(event.volume24hr),
    volume: toNumber(event.volume),
    liquidity: toNumber(event.liquidity),
    endDate: event.endDate ?? null,
    markets,
    url: `https://polymarket.com/event/${slug}`,
  };
}

export async function GET(request: NextRequest) {
  const orderParam = request.nextUrl.searchParams.get("order");
  const order =
    orderParam === "liquidity" || orderParam === "volume"
      ? orderParam === "volume"
        ? "volume24hr"
        : "liquidity"
      : "volume24hr";
  const limit = Math.min(
    40,
    Math.max(5, Number(request.nextUrl.searchParams.get("limit") ?? 24) || 24),
  );

  const url = new URL("https://gamma-api.polymarket.com/events");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("order", order);
  url.searchParams.set("ascending", "false");
  url.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 45 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Polymarket upstream ${response.status}`, events: [] },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as RawEvent[];
    const events = (Array.isArray(payload) ? payload : [])
      .map(normalizeEvent)
      .filter((e): e is EventView => Boolean(e));

    return NextResponse.json(
      {
        source: "polymarket-gamma",
        order,
        fetchedAt: new Date().toISOString(),
        events,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=45, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch",
        events: [],
      },
      { status: 502 },
    );
  }
}
