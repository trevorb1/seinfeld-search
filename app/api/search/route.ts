import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export interface SearchResult {
  line_id: number;
  episode_id: string;
  episode_num: number;
  episode_title: string;
  rating: number | null;
  num_votes: number | null;
  imdb_link: string | null;
  air_date: string | null;
  speaker: string;
  matched_dialogue: string;
  full_dialogue: string;
  rank: number;
}

/**
 * Sanitizes and formats an input string for SQLite FTS5 query syntax.
 * Balances unclosed quotes and provides a fallback to safe token matching
 * to prevent FTS5 syntax errors.
 */
function buildFtsQueries(input: string): { primary: string; fallback: string } {
  const trimmed = input.trim();

  // Primary: balance unclosed double quotes if any
  let balanced = trimmed;
  const quoteCount = (trimmed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    balanced += '"';
  }

  // Fallback: tokenize words and wrap in safe prefix match tokens: "word"*
  const cleanTokens = trimmed
    .replace(/["'*^:(){}[\]+\-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);

  const fallback = cleanTokens.map((t) => `"${t}"*`).join(" ");

  return { primary: balanced, fallback };
}

const baseSelectSql = `
  SELECT 
      sl.id AS line_id,
      e.episode_id,
      e.episode_num,
      e.episode_title,
      r.rating,
      r.num_votes,
      r.link AS imdb_link,
      c.date AS air_date,
      sl.speaker,
      sl.dialogue AS full_dialogue,
      snippet(scriptline_fts, 1, '<mark>', '</mark>', '...', 16) AS matched_dialogue,
      bm25(scriptline_fts) AS rank
  FROM scriptline_fts
  JOIN scriptline sl ON scriptline_fts.rowid = sl.id
  JOIN episode e ON sl.episode_id = e.episode_id
  LEFT JOIN rating r ON e.episode_id = r.episode_id
  LEFT JOIN credit c ON e.episode_id = c.episode_id
  WHERE scriptline_fts MATCH :query
    AND (:speaker = '' OR sl.speaker = :speaker)
`;

const searchQueries = {
  relevance: db.prepare(`${baseSelectSql} ORDER BY rank LIMIT :limit OFFSET :offset;`),
  line_asc: db.prepare(`${baseSelectSql} ORDER BY sl.id ASC LIMIT :limit OFFSET :offset;`),
  line_desc: db.prepare(`${baseSelectSql} ORDER BY sl.id DESC LIMIT :limit OFFSET :offset;`),
};

const countQuery = db.prepare(`
  SELECT count(*) AS total
  FROM scriptline_fts
  JOIN scriptline sl ON scriptline_fts.rowid = sl.id
  WHERE scriptline_fts MATCH :query
    AND (:speaker = '' OR sl.speaker = :speaker);
`);

export type SortOrder = "relevance" | "line_asc" | "line_desc";

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const searchParams = request.nextUrl.searchParams;

  const rawQuery = searchParams.get("q")?.trim() || "";
  const speaker = searchParams.get("speaker")?.trim() || "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const sortParam = searchParams.get("sort")?.trim();
  const sort: SortOrder =
    sortParam === "line_asc" || sortParam === "line"
      ? "line_asc"
      : sortParam === "line_desc"
      ? "line_desc"
      : "relevance";

  const activeSearchQuery = searchQueries[sort];

  if (!rawQuery) {
    return NextResponse.json({
      results: [],
      total: 0,
      query: "",
      speaker: "",
      sort,
      tookMs: 0,
    });
  }

  const { primary, fallback } = buildFtsQueries(rawQuery);

  let results: SearchResult[] = [];
  let total = 0;

  try {
    // Attempt 1: primary query with balanced quotes
    results = activeSearchQuery.all({
      query: primary,
      speaker,
      limit,
      offset,
    }) as SearchResult[];

    const countRes = countQuery.get({
      query: primary,
      speaker,
    }) as { total: number } | undefined;
    total = countRes?.total ?? results.length;
  } catch {
    // Attempt 2: If primary FTS syntax fails, use fallback safe token prefix match
    if (fallback && fallback !== primary) {
      try {
        results = activeSearchQuery.all({
          query: fallback,
          speaker,
          limit,
          offset,
        }) as SearchResult[];

        const countRes = countQuery.get({
          query: fallback,
          speaker,
        }) as { total: number } | undefined;
        total = countRes?.total ?? results.length;
      } catch {
        // Safe generic error handling without exposing SQL stack traces
        return NextResponse.json(
          { error: "Search query syntax is not supported. Please try simpler keywords." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unable to process the search query. Please try different keywords." },
        { status: 400 }
      );
    }
  }

  const tookMs = Math.round((performance.now() - startTime) * 10) / 10;

  return NextResponse.json({
    results,
    total,
    query: rawQuery,
    speaker,
    sort,
    tookMs,
  });
}
