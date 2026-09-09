# Seinfeld Search

**Seinfeld Search** is a fast, full-text search engine and interactive script archive for the iconic television series *Seinfeld*. Powered by an embedded SQLite database with FTS5 indexing, it indexes all **9 seasons**, **172 episodes**, and **54,614 lines of dialogue**, allowing you to search quotes, filter by character, and jump straight to the exact line within full episode scripts.

## Tech stack

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/fts5.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)



---

## Features

- **Instant Full-Text Search (SQLite FTS5)**: Fast BM25-ranked search over 54,000+ dialogue lines with highlighted keyword snippets.
- **Character Filtering**: Filter quotes by your favorite characters, including Jerry, George, Elaine, Kramer, Newman, Frank Costanza, Estelle, Morty, J. Peterman, and David Puddy.
- **Complete Episode Scripts**: Read full episode scripts with speaker cues, dialogue, and scene setting descriptions.
- **Direct Line Deep Linking**: Click any search result to automatically load the full script, smoothly scroll down, and highlight the exact matching line.
- **In-Script Filtering**: Quickly filter dialogue within an active episode script in real time.
- **Episode Browser & Ratings**: Browse all 172 episodes by season with IMDb ratings, vote counts, air dates, runtimes, synopses, writers, and starring cast.

---

## Tech Stack

- **Backend API**: [seinpy](https://github.com/trevorb1/seinpy)
- **Frontend**: [next.js 16](https://nextjs.org) (App Router)
- **UI & Styling**: [react 19](https://react.dev), [tailwind css v4](https://tailwindcss.com)
- **Language**: [typescript](https://www.typescriptlang.org)

---

## Database Architecture

The application runs on an embedded, read-only SQLite database located at `data/seinfeld.db`:

| Table | Description | Records |
| :--- | :--- | :--- |
| `episode` | Episode catalog with season, episode numbers, and titles | 172 |
| `scriptline` | Full dialogue lines with line IDs, speaker labels, and episode references | 54,616 |
| `scriptline_fts` | SQLite FTS5 virtual table indexing lines for fast tokenized search | 54,616 |
| `rating` | IMDb ratings, vote counts, and IMDb URLs | 172 |
| `credit` | Episode air dates and synopses | 172 |
| `creditperson` | Writers and cast members attributed per episode | 2,800+ |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20.x or later recommended)
- `npm`, `pnpm`, `yarn`, or `bun`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/trevorb1/seinfeld-search.git
   cd seinfeld-search
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

---

## Available Scripts

- `npm run dev` — Starts the development server with hot reload.
- `npm run build` — Compiles and builds the production Next.js application.
- `npm run start` — Runs the compiled production build locally.
- `npm run lint` — Runs ESLint checks.

---