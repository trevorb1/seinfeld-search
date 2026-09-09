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
  runtime: string;
  synopsis: string | null;
  writers: string[];
  actors: string[];
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

const writersQuery = db.prepare(`
  SELECT DISTINCT name 
  FROM creditperson 
  WHERE episode_id = :episode_id AND type = 'writer' AND name IS NOT NULL AND name != 'N/A'
  ORDER BY id ASC;
`);

const actorsQuery = db.prepare(`
  SELECT DISTINCT name 
  FROM creditperson 
  WHERE episode_id = :episode_id AND type = 'actor' AND name IS NOT NULL AND name != 'N/A'
  ORDER BY id ASC;
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

    const episodeRaw = episodeDetailQuery.get({ episode_id: episodeId }) as
      | Omit<EpisodeDetail, "writers" | "actors" | "runtime">
      | undefined;

    if (!episodeRaw) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    const lines = scriptLinesQuery.all({ episode_id: episodeId }) as ScriptLine[];

    // Query writers and starring actors
    const writerRows = writersQuery.all({ episode_id: episodeId }) as { name: string }[];
    const actorRows = actorsQuery.all({ episode_id: episodeId }) as { name: string }[];

    const writers = writerRows.map((r) => r.name);
    let actors = actorRows.map((r) => r.name);

    // Fallback for pilot or any episodes missing actor credits
    if (actors.length === 0) {
      actors = ["Jerry Seinfeld", "Jason Alexander", "Julia Louis-Dreyfus", "Michael Richards"];
    }

    // Determine episode runtime based on line count and episode format
    const runtime = lines.length >= 1300 ? "55 min" : lines.length >= 950 ? "46 min" : "23 min";

    const episode: EpisodeDetail = {
      ...episodeRaw,
      runtime,
      writers,
      actors,
    };

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

