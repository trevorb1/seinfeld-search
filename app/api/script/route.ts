import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export interface ScriptLine {
  id: number;
  speaker: string;
  dialogue: string;
}

export interface EpisodeDetail {
  episode_id: string;
  episode_num: number;
  episode_title: string;
  season: number;
  episode_in_season: number;
  rating: number | null;
  imdb_link: string | null;
  air_date: string | null;
  synopsis: string | null;
}

const episodeDetailQuery = db.prepare(`
  SELECT 
      e.episode_id,
      e.episode_num,
      e.episode_title,
      CAST(substr(e.episode_id, 2, 2) AS INTEGER) AS season,
      CAST(substr(e.episode_id, 5, 2) AS INTEGER) AS episode_in_season,
      r.rating,
      r.link AS imdb_link,
      c.date AS air_date,
      c.description AS synopsis
  FROM episode e
  LEFT JOIN rating r ON e.episode_id = r.episode_id
  LEFT JOIN credit c ON e.episode_id = c.episode_id
  WHERE e.episode_id = :episode_id
  LIMIT 1;
`);

const scriptLinesQuery = db.prepare(`
  SELECT id, speaker, dialogue
  FROM scriptline
  WHERE episode_id = :episode_id
  ORDER BY id ASC;
`);

export async function GET(request: NextRequest) {
  try {
    const episodeId = request.nextUrl.searchParams.get("episode_id")?.trim();

    if (!episodeId) {
      return NextResponse.json(
        { error: "episode_id parameter is required" },
        { status: 400 }
      );
    }

    const episode = episodeDetailQuery.get({ episode_id: episodeId }) as
      | EpisodeDetail
      | undefined;

    if (!episode) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    const lines = scriptLinesQuery.all({ episode_id: episodeId }) as ScriptLine[];

    return NextResponse.json({
      episode,
      lines,
      totalLines: lines.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load episode script" },
      { status: 500 }
    );
  }
}
