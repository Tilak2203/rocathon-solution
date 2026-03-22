import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { Pool } from 'pg';
import type { Creator } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });

function buildEmbedText(c: Creator): string {
  const tags = c.content_style_tags.join(', ');
  return `${c.bio} [${tags}]`;
}

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

async function main() {
  const creators: Creator[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'creators.json'), 'utf-8')
  );
  console.log(`Loaded ${creators.length} creators`);

  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS creators (
      username           TEXT PRIMARY KEY,
      bio                TEXT         NOT NULL,
      content_style_tags TEXT[]       NOT NULL,
      projected_score    FLOAT        NOT NULL,
      follower_count     BIGINT       NOT NULL,
      total_gmv_30d      FLOAT        NOT NULL,
      avg_views_30d      BIGINT       NOT NULL,
      engagement_rate    FLOAT        NOT NULL,
      gpm                FLOAT        NOT NULL,
      major_gender       TEXT         NOT NULL,
      gender_pct         INT          NOT NULL,
      age_ranges         TEXT[]       NOT NULL,
      embedding          vector(1536)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS creators_embedding_idx
      ON creators
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 50);
  `);

  console.log('Schema ready');

  const BATCH = 20;
  for (let i = 0; i < creators.length; i += BATCH) {
    const batch = creators.slice(i, i + BATCH);

    await Promise.all(batch.map(async (c) => {
      const text      = buildEmbedText(c);
      const embedding = await embed(text);
      const vec       = `[${embedding.join(',')}]`;

      await pool.query(`
        INSERT INTO creators (
          username, bio, content_style_tags, projected_score,
          follower_count, total_gmv_30d, avg_views_30d,
          engagement_rate, gpm,
          major_gender, gender_pct, age_ranges,
          embedding
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (username) DO UPDATE SET
          embedding       = EXCLUDED.embedding,
          projected_score = EXCLUDED.projected_score,
          total_gmv_30d   = EXCLUDED.total_gmv_30d,
          gpm             = EXCLUDED.gpm;
      `, [
        c.username,
        c.bio,
        c.content_style_tags,
        c.projected_score,
        c.metrics.follower_count,
        c.metrics.total_gmv_30d,
        c.metrics.avg_views_30d,
        c.metrics.engagement_rate,
        c.metrics.gpm,
        c.metrics.demographics.major_gender,
        c.metrics.demographics.gender_pct,
        c.metrics.demographics.age_ranges,
        vec,
      ]);
    }));

    console.log(`  ${Math.min(i + BATCH, creators.length)} / ${creators.length} ingested`);
  }

  console.log('Done.');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });