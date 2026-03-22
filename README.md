# RoC Hackathon — Semantic Projected Score Engine

## The Problem

Brands search for creators with rigid filters (age bracket, category tag).
That misses the creative context. A brand selling rugged phone cases might
want a creator who does extreme outdoor stunts — irrelevant of their category.

But pure semantic AI search is dangerous in commerce: it might surface the
perfect stylistic match with $0 sales history. Brands need ROI, not just vibe.

## Your Mission

Build `searchCreators(query, brandProfile)` — a hybrid search function that:

- Takes a natural language query and a brand profile as input
- Returns a ranked list of creators who are both **semantically relevant** and **commercially viable**
- Exposes `semantic_score`, `projected_score`, and `final_score` per creator

## What's Given

- `creators.json` — 200 mock creators with bios, content tags, metrics, and a `projected_score` (60–100) pre-computed by RoC
- `src/types.ts` — TypeScript interfaces for Creator, BrandProfile, and RankedCreator
- `src/searchCreators.ts` — function skeleton to implement

## What You Build

Everything else:
- Your vector DB setup (use [Supabase free tier](https://supabase.com) or local Docker + pgvector)
- Your ingestion script to embed and store creators
- Your `searchCreators` implementation
- Your hybrid scoring formula

## Setup

### 1. Clone + install

```bash
git clone <your-fork>
cd roc-hackathon
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and DATABASE_URL
```

### 3. Set up your vector DB

Option A — Supabase (recommended, no Docker):
- Create a free project at supabase.com
- Enable the `pgvector` extension: SQL Editor → `CREATE EXTENSION IF NOT EXISTS vector;`
- Copy the connection string to `DATABASE_URL`

Option B — Local Docker:
- Requires Docker installed
- Set up your own `docker-compose.yml` with `pgvector/pgvector:pg15`

### 4. Create your schema

Design your own table schema. At minimum you'll need a `vector` column for embeddings.

### 5. Ingest creators

```bash
npm run ingest
```

### 6. Run demo

```bash
npm run demo
```

## Deliverables

Submit a Git repo with:

- [ ] `README.md` with setup instructions
- [ ] DB schema + ingest instructions
- [ ] `src/searchCreators.ts` implementation
- [ ] Output JSON: top 10 results for query `"Affordable home decor for small apartments"` using the `brand_smart_home` profile
- [ ] 2-minute Loom walkthrough
