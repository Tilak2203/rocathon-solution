# RoC Hackathon : Semantic Creator Search Engine

A hybrid search engine that ranks TikTok Shop creators by both semantic relevance and commerce performance. Built with TypeScript, pgvector, and OpenAI embeddings.

---

## How it works

1. Each creator's bio + content tags are embedded using OpenAI and stored in PostgreSQL with pgvector
2. At query time, a fused query (natural language + brand profile context) is embedded and compared against stored vectors using cosine similarity
3. The top 50 candidates are re-ranked using a weighted blend of semantic score, projected score, GMV, demographics, and GPM
4. Hard multipliers penalise zero-GMV creators and category mismatches before returning the top 10

---

## Prerequisites

- Node.js 18+
- An OpenAI API key
- PostgreSQL with pgvector — either via Supabase (recommended) or local Docker

---

## 1. Clone and install

```bash
git clone <your-repo-url>
cd roc-hackathon
npm install
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in both values:

```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## 3. Set up the database

### Option A — Supabase (recommended, no Docker required)

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In the Supabase dashboard, open **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy your connection string from **Project Settings → Database → Connection string (URI)**
4. Paste it into `DATABASE_URL` in your `.env`

> The ingest script will automatically create the `creators` table and IVFFlat index on first run - no manual schema setup needed.

### Option B — Local Docker

1. Make sure Docker is installed and running
2. Create a `docker-compose.yml` in the project root:

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: roc
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

3. Start the container:

```bash
docker compose up -d
```

4. Set your `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roc
```

---

## 4. Ingest creators

Run the ingest script to embed all creators and load them into the database:

```bash
npm run ingest
```

This will:
- Enable the `vector` extension in Postgres
- Create the `creators` table if it does not exist
- Create an IVFFlat cosine similarity index
- Embed each creator's bio + content tags using `text-embedding-3-small`
- Insert all records in batches of 20 (safe for OpenAI rate limits)

Expected output:

```
Loaded 200 creators
Schema ready
  20 / 200 ingested
  40 / 200 ingested
  ...
  200 / 200 ingested
Done.
```

> Re-running ingest is safe — it uses `ON CONFLICT DO UPDATE` so existing records are updated, not duplicated.

---

## 5. Run the demo

```bash
npm run demo
```

This runs a search for `"Affordable home decor for small apartments"` using the `brand_smart_home` profile and writes the top 10 results to `output.json`.

Expected output:

```
Query: "Affordable home decor for small apartments"
Brand: brand_smart_home

Searching...

1. @small_space_living_lee
   Bio:       Maximizing tiny apartments and studio spaces. Clever storage solution...
   Tags:      Home
   GMV 30d:   $31,445
   GPM:       40
   Semantic:  0.5096
   Projected: 90.2
   Final:     0.5963

...

output.json written to /path/to/output.json
```

---

## Project structure

```
roc-hackathon/
├── src/
│   ├── types.ts              # TypeScript interfaces (Creator, BrandProfile, RankedCreator)
│   ├── ingest.ts             # One-time script: embed + load creators into pgvector
│   ├── searchCreators.ts     # Core hybrid search and ranking logic
│   └── demo.ts               # Runs search for brand_smart_home, writes output.json
├── creators.json             # 200 mock creators (air-gapped dataset)
├── output.json               # Top 10 results for the required query
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Scoring formula

Each candidate is scored using a weighted blend of five signals:

| Signal | Weight | Description |
|---|---|---|
| Semantic score | 40% | Cosine similarity between fused query and creator embedding |
| Projected score | 30% | RoC pre-computed commerce prediction, normalised 60–100 → 0–1 |
| GMV norm | 20% | 30-day GMV normalised against $50k benchmark |
| Demo match | 7% | Gender match × age range IOU against brand target audience |
| GPM norm | 3% | Gross profit per 1000 views, normalised against 50 ceiling |

**Multipliers applied after the blend:**

| Condition | Multiplier |
|---|---|
| GMV = $0 | 0.30× |
| GMV < $1,000 | 0.60× |
| No category overlap with brand industries | 0.70× |

Creators below 0.40 cosine similarity are filtered before scoring (semantic floor).

---

## Deliverables

- [x] `README.md` — this file
- [x] DB schema + ingest instructions — see sections 3 and 4 above
- [x] `src/searchCreators.ts` — hybrid search implementation
- [x] `output.json` — top 10 results for `brand_smart_home` profile
- [ ] Loom walkthrough (2 minutes)
