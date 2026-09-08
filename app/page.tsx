"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";
import type { EpisodeSummary } from "@/app/api/episodes/route";
import type { EpisodeDetail, ScriptLine } from "@/app/api/script/route";

export type View = "home" | "episodes" | "results" | "script";

const CHARACTERS = [
  { name: "Jerry Seinfeld", id: "Jerry", initials: "JS" },
  { name: "George Costanza", id: "George", initials: "GC" },
  { name: "Elaine Benes", id: "Elaine", initials: "EB" },
  { name: "Cosmo Kramer", id: "Kramer", initials: "CK" },
  { name: "Newman", id: "Newman", initials: "N" },
  { name: "Frank Costanza", id: "Frank", initials: "FC" },
  { name: "Estelle Costanza", id: "Estelle", initials: "EC" },
  { name: "Morty Seinfeld", id: "Morty", initials: "MS" },
  { name: "J. Peterman", id: "Peterman", initials: "JP" },
  { name: "David Puddy", id: "Puddy", initials: "DP" },
];

const HINTS = [
  '"These pretzels are making me thirsty"',
  '"Shrinkage"',
  '"No soup for you!"',
  '"Serenity now"',
  '"Vandelay Industries"',
  '"Marine biologist"',
];

/**
 * Safely renders dialogue snippets containing SQLite FTS `<mark>` tags.
 * Avoids dangerouslySetInnerHTML completely by splitting on the tag boundaries
 * and producing safe React text nodes and styled mark elements.
 */
function SafeHighlightedSnippet({ snippet }: { snippet: string }) {
  const parts = snippet.split(/(<mark>[\s\S]*?<\/mark>)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
          const content = part.slice(6, -7);
          return (
            <mark
              key={index}
              style={{
                backgroundColor: "#fce79a",
                color: "#5c1818",
                padding: "0.1em 0.3em",
                borderRadius: "2px",
                fontWeight: 600,
              }}
            >
              {content}
            </mark>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}

function MainApp() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlQuery = searchParams.get("q") || "";
  const urlSpeaker = searchParams.get("speaker") || "";
  const urlView = (searchParams.get("view") as View) || (urlQuery ? "results" : "home");
  const urlEp = searchParams.get("ep") || "";
  const urlLine = searchParams.get("line") ? parseInt(searchParams.get("line")!, 10) : null;

  const [view, setView] = useState<View>(urlView);
  const [query, setQuery] = useState(urlQuery);
  const [submittedQuery, setSubmittedQuery] = useState(urlQuery);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(
    urlSpeaker ? [urlSpeaker] : []
  );

  // Search Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Episodes List state
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Script Reader state
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>(urlEp);
  const [targetLineId, setTargetLineId] = useState<number | null>(urlLine);
  const [scriptEpisode, setScriptEpisode] = useState<EpisodeDetail | null>(null);
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptBackView, setScriptBackView] = useState<"episodes" | "results">("episodes");

  // Load episodes once for All Episodes view or stats
  useEffect(() => {
    async function loadEpisodes() {
      setEpisodesLoading(true);
      try {
        const res = await fetch("/api/episodes");
        if (res.ok) {
          const data = await res.json();
          setEpisodes(data.episodes || []);
        }
      } catch {
        // Fallback
      } finally {
        setEpisodesLoading(false);
      }
    }
    loadEpisodes();
  }, []);

  // Perform search when submittedQuery or selectedCharacters change
  useEffect(() => {
    if (!submittedQuery.trim() && selectedCharacters.length === 0) {
      setResults([]);
      setTotalResults(0);
      return;
    }

    const speakerParam = selectedCharacters.length === 1 ? selectedCharacters[0] : "";
    const searchTerm = submittedQuery.trim() || (speakerParam ? "*" : "");

    if (!searchTerm) return;

    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);

    const params = new URLSearchParams({
      q: searchTerm,
      ...(speakerParam ? { speaker: speakerParam } : {}),
      limit: "50",
    });

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Search failed");
        }
        return res.json();
      })
      .then((data) => {
        setResults(data.results || []);
        setTotalResults(data.total || 0);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setSearchError(err.message || "Failed to fetch results");
        setResults([]);
        setTotalResults(0);
      })
      .finally(() => {
        setSearchLoading(false);
      });

    return () => controller.abort();
  }, [submittedQuery, selectedCharacters]);

  // Load script when activeEpisodeId changes
  useEffect(() => {
    if (!activeEpisodeId || view !== "script") return;

    setScriptLoading(true);
    setScriptEpisode(null);
    setScriptLines([]);

    fetch(`/api/script?episode_id=${encodeURIComponent(activeEpisodeId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load script");
        return res.json();
      })
      .then((data) => {
        setScriptEpisode(data.episode);
        setScriptLines(data.lines || []);
      })
      .catch(() => {
        // Handle error
      })
      .finally(() => {
        setScriptLoading(false);
      });
  }, [activeEpisodeId, view]);

  // Navigation handlers
  function goHome() {
    setView("home");
    setQuery("");
    setSubmittedQuery("");
    setSelectedCharacters([]);
    router.replace("/", { scroll: false });
  }

  function goToEpisodes() {
    setView("episodes");
    router.replace("/?view=episodes", { scroll: false });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() && selectedCharacters.length === 0) return;
    setSubmittedQuery(query.trim());
    setView("results");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCharacters.length === 1) params.set("speaker", selectedCharacters[0]);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  function openScript(episodeId: string, lineId: number | null, fromView: "episodes" | "results") {
    setActiveEpisodeId(episodeId);
    setTargetLineId(lineId);
    setScriptBackView(fromView);
    setView("script");
    const params = new URLSearchParams();
    params.set("view", "script");
    params.set("ep", episodeId);
    if (lineId) params.set("line", String(lineId));
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-[#8b1c1c]/20"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
    >
      {/* Header matching Figma */}
      <header
        className="border-b px-6 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "rgba(245, 240, 232, 0.92)",
        }}
      >
        <button
          onClick={goHome}
          className="flex items-baseline gap-3 group text-left"
        >
          <span
            className="font-semibold text-lg leading-none transition-opacity group-hover:opacity-80"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Seinfeld Search
          </span>
        </button>

        <nav className="flex items-center gap-6">
          <button
            onClick={goToEpisodes}
            className="text-sm transition-colors hover:opacity-100"
            style={{
              fontFamily: "'DM Mono', monospace",
              color: view === "episodes" ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: view === "episodes" ? 500 : 400,
              letterSpacing: "0.05em",
            }}
          >
            All Episodes
          </button>
        </nav>
      </header>

      {/* Main View Area */}
      <main className="flex-1">
        {view === "home" && (
          <HomeView
            query={query}
            setQuery={setQuery}
            selectedCharacters={selectedCharacters}
            setSelectedCharacters={setSelectedCharacters}
            onSearch={handleSearchSubmit}
            onViewEpisodes={goToEpisodes}
            episodesCount={episodes.length || 172}
          />
        )}

        {view === "results" && (
          <SearchResultsView
            query={submittedQuery}
            results={results}
            totalResults={totalResults}
            loading={searchLoading}
            error={searchError}
            onBack={() => setView("home")}
            onOpenScript={(epId, lineId) => openScript(epId, lineId, "results")}
          />
        )}

        {view === "episodes" && (
          <EpisodesView
            episodes={episodes}
            loading={episodesLoading}
            onBack={goHome}
            onSelectEpisode={(epId) => openScript(epId, null, "episodes")}
            onSearchQuote={(q) => {
              setQuery(q);
              setSubmittedQuery(q);
              setView("results");
            }}
          />
        )}

        {view === "script" && (
          <ScriptView
            episode={scriptEpisode}
            lines={scriptLines}
            loading={scriptLoading}
            targetLineId={targetLineId}
            backView={scriptBackView}
            onBack={() => setView(scriptBackView)}
          />
        )}
      </main>

      {/* Footer matching Figma */}
      <footer
        className="border-t px-6 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-xs"
          style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
        >
          &copy; 2026 — Script Archive
        </span>
        <span
          className="text-xs"
          style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
        >
          All 9 Seasons · 172 Episodes · 109,232 Lines
        </span>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------
// 1. HOME VIEW (Exact Figma Design & Elements)
// ----------------------------------------------------------------------
function HomeView({
  query,
  setQuery,
  selectedCharacters,
  setSelectedCharacters,
  onSearch,
  onViewEpisodes,
  episodesCount,
}: {
  query: string;
  setQuery: (q: string) => void;
  selectedCharacters: string[];
  setSelectedCharacters: React.Dispatch<React.SetStateAction<string[]>>;
  onSearch: (e: React.FormEvent) => void;
  onViewEpisodes: () => void;
  episodesCount: number;
}) {
  function toggleCharacter(name: string) {
    setSelectedCharacters((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] px-6 py-12">
      {/* Decorative rule + label */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 sm:w-16 h-px" style={{ backgroundColor: "var(--border)" }} />
        <span
          className="text-xs tracking-[0.25em] uppercase"
          style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
        >
          Search the Scripts
        </span>
        <div className="w-12 sm:w-16 h-px" style={{ backgroundColor: "var(--border)" }} />
      </div>

      {/* Title */}
      <h1
        className="text-center mb-3 leading-tight"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        Seinfeld Search
      </h1>
      <p
        className="text-center mb-10 max-w-md"
        style={{
          fontFamily: "'Source Sans 3', sans-serif",
          color: "var(--muted-foreground)",
          fontSize: "1.05rem",
          fontWeight: 300,
          lineHeight: 1.6,
        }}
      >
        Search across every line of dialogue, scene description, and stage direction from all 9 seasons.
      </p>

      {/* Search form */}
      <form onSubmit={onSearch} className="w-full max-w-2xl">
        <div
          className="flex items-stretch border transition-all focus-within:ring-1 focus-within:ring-[var(--foreground)]"
          style={{ borderColor: "var(--foreground)", backgroundColor: "var(--card)" }}
        >
          {/* Search icon */}
          <div className="flex items-center px-4" style={{ color: "var(--muted-foreground)" }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dialogue, scenes, characters…"
            className="flex-1 py-3.5 sm:py-4 bg-transparent outline-none text-base"
            style={{
              fontFamily: "'Source Sans 3', sans-serif",
              color: "var(--foreground)",
              fontSize: "1rem",
            }}
            autoFocus
          />

          <button
            type="submit"
            className="px-6 py-3.5 sm:py-4 text-sm font-medium transition-opacity hover:opacity-85 cursor-pointer"
            style={{
              fontFamily: "'DM Mono', monospace",
              backgroundColor: "var(--foreground)",
              color: "var(--background)",
              letterSpacing: "0.05em",
            }}
          >
            Search
          </button>
        </div>

        {/* Hint row */}
        <div className="flex gap-3 sm:gap-4 mt-3 px-1 flex-wrap">
          {HINTS.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => {
                setQuery(hint.replace(/"/g, ""));
              }}
              className="text-xs transition-colors hover:underline text-left"
              style={{
                fontFamily: "'DM Mono', monospace",
                color: "var(--muted-foreground)",
              }}
            >
              {hint}
            </button>
          ))}
        </div>
      </form>

      {/* Character filters */}
      <div className="w-full max-w-2xl mt-8">
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-xs tracking-[0.15em] uppercase"
            style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
          >
            Filter by character
          </span>
          {selectedCharacters.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCharacters([])}
              className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
              style={{ fontFamily: "'DM Mono', monospace", color: "var(--accent)" }}
            >
              clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {CHARACTERS.map((char) => {
            const active = selectedCharacters.includes(char.id);
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => toggleCharacter(char.id)}
                className="flex items-center gap-2 px-3 py-1.5 border text-xs transition-all cursor-pointer"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontWeight: active ? 600 : 400,
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  backgroundColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-foreground)" : "var(--foreground)",
                }}
              >
                <span
                  className="w-4 h-4 flex items-center justify-center text-[9px] rounded-full shrink-0"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    backgroundColor: active ? "rgba(255,255,255,0.25)" : "var(--muted)",
                    color: active ? "var(--accent-foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {char.initials}
                </span>
                {char.name}
              </button>
            );
          })}
        </div>

        {selectedCharacters.length > 0 && (
          <p
            className="mt-2 text-xs"
            style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
          >
            Showing lines spoken by{" "}
            {selectedCharacters.length === 1
              ? CHARACTERS.find((c) => c.id === selectedCharacters[0])?.name || selectedCharacters[0]
              : `${selectedCharacters.length} characters`}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="w-full max-w-2xl my-10 flex items-center gap-4">
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
        <span
          className="text-xs"
          style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
        >
          or
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
      </div>

      {/* View all episodes */}
      <button
        onClick={onViewEpisodes}
        className="group flex items-center gap-3 border px-8 py-3 transition-all hover:bg-[var(--foreground)] hover:text-[var(--background)] cursor-pointer"
        style={{
          borderColor: "var(--foreground)",
          fontFamily: "'Source Sans 3', sans-serif",
          fontWeight: 500,
          fontSize: "0.95rem",
        }}
      >
        <span>View All Episodes</span>
        <svg
          className="transition-transform group-hover:translate-x-1"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      {/* Stats row */}
      <div className="mt-16 flex items-center gap-8 sm:gap-12 flex-wrap justify-center">
        {[
          { label: "Episodes", value: String(episodesCount) },
          { label: "Seasons", value: "09" },
          { label: "Lines of Dialogue", value: "109,232" },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span
              className="text-2xl font-semibold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {value}
            </span>
            <span
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. SEARCH RESULTS VIEW (Figma Layout + Read Script Action)
// ----------------------------------------------------------------------
function SearchResultsView({
  query,
  results,
  totalResults,
  loading,
  error,
  onBack,
  onOpenScript,
}: {
  query: string;
  results: SearchResult[];
  totalResults: number;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onOpenScript: (episodeId: string, lineId: number) => void;
}) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const seasonsCount = new Set(
    results.map((r) => r.episode_id.slice(0, 3))
  ).size;

  async function handleCopy(id: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-5 text-xs transition-opacity hover:opacity-60 cursor-pointer"
          style={{
            fontFamily: "'DM Mono', monospace",
            color: "var(--muted-foreground)",
            letterSpacing: "0.05em",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          New Search
        </button>

        <div className="flex items-baseline gap-4 flex-wrap">
          <h2
            className="text-3xl font-semibold"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Results for
          </h2>
          <span
            className="text-3xl font-semibold italic"
            style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent)" }}
          >
            "{query || "Character Lines"}"
          </span>
        </div>

        {!loading && (
          <p
            className="mt-2 text-sm"
            style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
          >
            {totalResults.toLocaleString()} matches · across {seasonsCount} season
            {seasonsCount === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="border p-5 animate-pulse space-y-3"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
            >
              <div className="flex gap-3">
                <div className="h-4 w-16 bg-black/10 rounded" />
                <div className="h-4 w-32 bg-black/10 rounded" />
              </div>
              <div className="h-4 w-5/6 bg-black/10 rounded" />
              <div className="h-4 w-2/3 bg-black/10 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          className="border p-6 text-sm"
          style={{
            borderColor: "var(--accent)",
            backgroundColor: "rgba(139, 28, 28, 0.05)",
            color: "var(--accent)",
          }}
        >
          <p className="font-semibold">Notice</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Zero results */}
      {!loading && !error && results.length === 0 && (
        <div
          className="border p-10 text-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <h3
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            "What's the deal with this search?"
          </h3>
          <p
            className="text-sm max-w-md mx-auto"
            style={{ color: "var(--muted-foreground)" }}
          >
            No dialogue lines matched your query. Try fewer keywords or checking
            spelling.
          </p>
        </div>
      )}

      {/* Results List */}
      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-4">
          {results.map((result) => (
            <div
              key={result.line_id}
              className="border p-5 transition-colors hover:border-[var(--foreground)] group"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              {/* Meta row matching Figma */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 border"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    borderColor: "var(--foreground)",
                    color: "var(--foreground)",
                  }}
                >
                  {result.episode_id}
                </span>

                <span
                  className="text-sm font-medium"
                  style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
                >
                  {result.episode_title}
                </span>

                <span className="text-xs" style={{ color: "var(--border)" }}>
                  ·
                </span>

                <span
                  className="text-xs"
                  style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
                >
                  Ep {result.episode_num}
                </span>

                {result.air_date && (
                  <>
                    <span className="text-xs" style={{ color: "var(--border)" }}>
                      ·
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {result.air_date}
                    </span>
                  </>
                )}

                <span className="text-xs" style={{ color: "var(--border)" }}>
                  ·
                </span>

                <span
                  className="text-xs"
                  style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
                >
                  Line #{result.line_id}
                </span>

                {result.rating && (
                  <>
                    <span className="text-xs" style={{ color: "var(--border)" }}>
                      ·
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--accent)",
                      }}
                    >
                      ⭐ {(result.rating / 10).toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              {/* Speaker + Dialogue */}
              <div className="flex gap-3 items-start">
                <span
                  className="text-xs pt-0.5 shrink-0 tracking-wider uppercase font-semibold"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--accent)",
                  }}
                >
                  {result.speaker}
                </span>
                <p
                  className="text-base leading-relaxed flex-1"
                  style={{ fontFamily: "'Source Sans 3', sans-serif" }}
                >
                  <SafeHighlightedSnippet snippet={result.matched_dialogue} />
                </p>
              </div>

              {/* Action buttons (Read in Script & Copy) */}
              <div
                className="mt-4 pt-3 flex items-center justify-between text-xs"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  type="button"
                  onClick={() => onOpenScript(result.episode_id, result.line_id)}
                  className="inline-flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70 cursor-pointer"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--foreground)",
                    letterSpacing: "0.03em",
                  }}
                >
                  <span>Read in Full Script</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(result.line_id, result.full_dialogue)}
                  className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {copiedId === result.line_id ? (
                    <span style={{ color: "var(--accent)" }}>Copied!</span>
                  ) : (
                    <span>Copy</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. EPISODES VIEW (Exact Figma Season Groupings & Click to Script)
// ----------------------------------------------------------------------
function EpisodesView({
  episodes,
  loading,
  onBack,
  onSelectEpisode,
  onSearchQuote,
}: {
  episodes: EpisodeSummary[];
  loading: boolean;
  onBack: () => void;
  onSelectEpisode: (episodeId: string) => void;
  onSearchQuote: (quote: string) => void;
}) {
  const [activeSeason, setActiveSeason] = useState<number | null>(null);

  // Group episodes by season
  const seasonsMap = new Map<number, EpisodeSummary[]>();
  for (let i = 1; i <= 9; i++) {
    seasonsMap.set(i, []);
  }
  for (const ep of episodes) {
    const list = seasonsMap.get(ep.season);
    if (list) {
      list.push(ep);
    }
  }

  const seasonsList = Array.from(seasonsMap.entries())
    .filter(([, eps]) => eps.length > 0)
    .map(([seasonNum, eps]) => ({
      season: seasonNum,
      episodes: eps,
    }));

  const displayedSeasons = activeSeason
    ? seasonsList.filter((s) => s.season === activeSeason)
    : seasonsList;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-12">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 mb-5 text-xs transition-opacity hover:opacity-60 cursor-pointer"
            style={{
              fontFamily: "'DM Mono', monospace",
              color: "var(--muted-foreground)",
              letterSpacing: "0.05em",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Search
          </button>
          <h2
            className="text-4xl font-semibold mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            All Episodes
          </h2>
          <p
            className="text-sm"
            style={{
              color: "var(--muted-foreground)",
              fontFamily: "'Source Sans 3', sans-serif",
            }}
          >
            Browse by season · click any episode to read its full screenplay script
          </p>
        </div>

        {/* Season filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveSeason(null)}
            className="px-3 py-1.5 text-xs border transition-all cursor-pointer"
            style={{
              fontFamily: "'DM Mono', monospace",
              borderColor: activeSeason === null ? "var(--foreground)" : "var(--border)",
              backgroundColor: activeSeason === null ? "var(--foreground)" : "transparent",
              color: activeSeason === null ? "var(--background)" : "var(--muted-foreground)",
            }}
          >
            All
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
            <button
              key={s}
              onClick={() => setActiveSeason(s)}
              className="px-3 py-1.5 text-xs border transition-all cursor-pointer"
              style={{
                fontFamily: "'DM Mono', monospace",
                borderColor: activeSeason === s ? "var(--foreground)" : "var(--border)",
                backgroundColor: activeSeason === s ? "var(--foreground)" : "transparent",
                color: activeSeason === s ? "var(--background)" : "var(--muted-foreground)",
              }}
            >
              S{String(s).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          className="text-center py-16 text-sm"
          style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
        >
          Loading episodes archive...
        </div>
      )}

      {/* Season groups */}
      {!loading &&
        displayedSeasons.map((seasonGroup) => (
          <div key={seasonGroup.season} className="mb-14">
            {/* Season heading */}
            <div className="flex items-center gap-4 mb-4">
              <span
                className="text-xs tracking-[0.2em] uppercase font-semibold"
                style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
              >
                Season {String(seasonGroup.season).padStart(2, "0")}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
              <span
                className="text-xs"
                style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
              >
                {seasonGroup.episodes.length} episodes
              </span>
            </div>

            {/* Episode list */}
            <div className="border" style={{ borderColor: "var(--border)" }}>
              {seasonGroup.episodes.map((ep, i) => (
                <div
                  key={ep.episode_id}
                  onClick={() => onSelectEpisode(ep.episode_id)}
                  className="w-full flex items-center gap-4 sm:gap-6 px-4 sm:px-5 py-3.5 text-left transition-colors hover:bg-black/5 group cursor-pointer"
                  style={{
                    borderTop: i > 0 ? `1px solid var(--border)` : "none",
                  }}
                >
                  <span
                    className="text-xs w-12 shrink-0 font-medium"
                    style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
                  >
                    {String(ep.season).padStart(2, "0")}×{String(ep.episode_in_season).padStart(2, "0")}
                  </span>

                  <span
                    className="flex-1 text-sm sm:text-base font-medium group-hover:underline underline-offset-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {ep.episode_title}
                  </span>

                  {ep.rating && (
                    <span
                      className="text-xs shrink-0 hidden md:inline font-medium"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--accent)",
                      }}
                    >
                      ⭐ {(ep.rating / 10).toFixed(1)}
                    </span>
                  )}

                  <span
                    className="text-xs hidden sm:block shrink-0"
                    style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
                  >
                    {ep.air_date || ""}
                  </span>

                  <span
                    className="text-xs w-20 text-right shrink-0"
                    style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
                  >
                    {ep.line_count.toLocaleString()} lines
                  </span>

                  <svg
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// 4. SCRIPT VIEW (Full Screenplay Reader with Target Line Scroll)
// ----------------------------------------------------------------------
function ScriptView({
  episode,
  lines,
  loading,
  targetLineId,
  backView,
  onBack,
}: {
  episode: EpisodeDetail | null;
  lines: ScriptLine[];
  loading: boolean;
  targetLineId: number | null;
  backView: "episodes" | "results";
  onBack: () => void;
}) {
  const [filterText, setFilterText] = useState("");
  const targetRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to target line when script loads
  useEffect(() => {
    if (targetLineId && targetRef.current) {
      setTimeout(() => {
        targetRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
    }
  }, [targetLineId, lines]);

  const filteredLines = filterText.trim()
    ? lines.filter(
        (l) =>
          l.dialogue.toLowerCase().includes(filterText.toLowerCase()) ||
          l.speaker.toLowerCase().includes(filterText.toLowerCase())
      )
    : lines;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-6 text-xs transition-opacity hover:opacity-60 cursor-pointer"
        style={{
          fontFamily: "'DM Mono', monospace",
          color: "var(--muted-foreground)",
          letterSpacing: "0.05em",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {backView === "results" ? "Back to Search Results" : "Back to All Episodes"}
      </button>

      {loading && (
        <div
          className="text-center py-20 text-sm"
          style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
        >
          Loading screenplay script...
        </div>
      )}

      {!loading && episode && (
        <div>
          {/* Episode Header */}
          <div
            className="border p-6 sm:p-8 mb-8"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <div className="flex items-center gap-3 mb-2 flex-wrap text-xs">
              <span
                className="px-2 py-0.5 border font-semibold"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  borderColor: "var(--foreground)",
                  color: "var(--foreground)",
                }}
              >
                {episode.episode_id}
              </span>
              <span
                style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
              >
                Episode {episode.episode_num} (Season {episode.season} · Ep {episode.episode_in_season})
              </span>
              {episode.air_date && (
                <>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span
                    style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
                  >
                    Aired {episode.air_date}
                  </span>
                </>
              )}
              {episode.rating && (
                <>
                  <span style={{ color: "var(--border)" }}>·</span>
                  {episode.imdb_link ? (
                    <a
                      href={episode.imdb_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold hover:underline"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--accent)",
                      }}
                    >
                      ⭐ {(episode.rating / 10).toFixed(1)} IMDb
                    </a>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--accent)",
                      }}
                    >
                      ⭐ {(episode.rating / 10).toFixed(1)}
                    </span>
                  )}
                </>
              )}
            </div>

            <h1
              className="text-3xl sm:text-4xl font-semibold mb-3 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {episode.episode_title}
            </h1>

            {episode.synopsis && (
              <p
                className="text-sm leading-relaxed"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  color: "var(--muted-foreground)",
                }}
              >
                {episode.synopsis}
              </p>
            )}

            <div
              className="mt-4 pt-3 flex items-center justify-between text-xs"
              style={{
                borderTop: "1px solid var(--border)",
                fontFamily: "'DM Mono', monospace",
                color: "var(--muted-foreground)",
              }}
            >
              <span>{lines.length} total lines in script</span>
              {targetLineId && (
                <span style={{ color: "var(--accent)" }}>
                  Navigated to Line #{targetLineId}
                </span>
              )}
            </div>
          </div>

          {/* Quick Script Filter */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div
              className="flex-1 flex items-center border px-3 py-2"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2.5 opacity-50"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter dialogue in this episode..."
                className="bg-transparent outline-none text-xs w-full"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--foreground)",
                }}
              />
              {filterText && (
                <button
                  onClick={() => setFilterText("")}
                  className="text-xs opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
            <span
              className="text-xs shrink-0"
              style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}
            >
              Showing {filteredLines.length} lines
            </span>
          </div>

          {/* Script Dialogue Lines */}
          <div
            className="border divide-y"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            {filteredLines.map((line) => {
              const isTarget = line.id === targetLineId;
              const isSceneSetting =
                line.speaker.startsWith("[") ||
                line.dialogue.startsWith("[Setting") ||
                line.dialogue.startsWith("(Scene");

              return (
                <div
                  key={line.id}
                  ref={isTarget ? targetRef : undefined}
                  id={`line-${line.id}`}
                  className={`p-4 sm:p-5 transition-colors ${
                    isTarget ? "ring-2 ring-[var(--accent)] bg-[#faebd7]" : ""
                  }`}
                  style={{
                    backgroundColor: isTarget ? "#faebd7" : undefined,
                  }}
                >
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        isSceneSetting ? "italic opacity-80" : ""
                      }`}
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: isSceneSetting ? "var(--muted-foreground)" : "var(--accent)",
                      }}
                    >
                      {line.speaker}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      #{line.id}
                    </span>
                  </div>

                  <p
                    className={`leading-relaxed text-sm sm:text-base ${
                      isSceneSetting ? "italic text-xs sm:text-sm opacity-90 font-serif" : ""
                    }`}
                    style={{
                      fontFamily: isSceneSetting
                        ? "'Playfair Display', serif"
                        : "'Source Sans 3', sans-serif",
                    }}
                  >
                    {line.dialogue}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center text-sm"
          style={{
            backgroundColor: "var(--background)",
            fontFamily: "'DM Mono', monospace",
            color: "var(--muted-foreground)",
          }}
        >
          Loading Seinfeld Script Archive...
        </div>
      }
    >
      <MainApp />
    </Suspense>
  );
}
