import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export interface EpisodeSummary {
  episode_id: string;
  episode_num: number;
  episode_title: string;
  season: number;
  episode_in_season: number;
  rating: number | null;
  imdb_link: string | null;
  air_date: string | null;
  synopsis: string | null;
  line_count: number;
}

const episodesQuery = db.prepare(`
  SELECT 
      e.episode_id,
      e.episode_num,
      e.episode_title,
      CAST(substr(e.episode_id, 2, 2) AS INTEGER) AS season,
      CAST(substr(e.episode_id, 5, 2) AS INTEGER) AS episode_in_season,
      r.rating,
      r.link AS imdb_link,
      c.date AS air_date,
      c.description AS synopsis,
      count(sl.id) AS line_count
  FROM episode e
  LEFT JOIN rating r ON e.episode_id = r.episode_id
  LEFT JOIN credit c ON e.episode_id = c.episode_id
  LEFT JOIN scriptline sl ON e.episode_id = sl.episode_id
  WHERE (:season = 0 OR CAST(substr(e.episode_id, 2, 2) AS INTEGER) = :season)
  GROUP BY e.episode_id
  ORDER BY e.episode_num ASC;
`);

export async function GET(request: NextRequest) {
  try {
    const seasonParam = request.nextUrl.searchParams.get("season");
    const season = seasonParam ? parseInt(seasonParam, 10) || 0 : 0;

    const episodes = episodesQuery.all({ season }) as EpisodeSummary[];

    return NextResponse.json({
      episodes,
      total: episodes.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load episodes list" },
      { status: 500 }
    );
  }
}
