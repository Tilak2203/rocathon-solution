import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { Pool } from 'pg';
import type { BrandProfile, RankedCreator } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });

function buildFusedQuery(query: string, brand: BrandProfile): string {
  return `${query} for brand targeting ${brand.target_audience.gender} `
       + `${brand.target_audience.age_ranges.join(',')} `
       + `in ${brand.industries.join(',')}`;
}

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}


function ageIOU(creatorAges: string[], brandAges: string[]): number {
  const A = new Set(creatorAges);
  const B = new Set(brandAges);
  const intersection = [...A].filter(x => B.has(x)).length;
  const union        = new Set([...A, ...B]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function searchCreators(
  query: string,
  brandProfile: BrandProfile
): Promise<RankedCreator[]> {

  // Fused query embedding
  const fusedQuery    = buildFusedQuery(query, brandProfile);
  const queryVector   = await embed(fusedQuery);
  const vectorLiteral = `[${queryVector.join(',')}]`;

  // Trying to find top 50 candidates on the basis of cosine similarity using vector search.
  const { rows } = await pool.query(`
    SELECT
      username, bio, content_style_tags, projected_score,
      follower_count, total_gmv_30d, avg_views_30d,
      engagement_rate, gpm, major_gender, gender_pct, age_ranges,
      1 - (embedding <=> $1::vector) AS semantic_score
    FROM creators
    ORDER BY embedding <=> $1::vector ASC
    LIMIT 50
  `, [vectorLiteral]);


  // Trying to filter out candidates with very low semantic similarity, 
  // but ensuring we have at least 5 candidates to score and rank. 
  // The floor is a tunable parameter  higher means stricter relevance requirement.
  const MIN_SEMANTIC = 0.40;
  const filtered    = rows.filter(row => parseFloat(row.semantic_score) >= MIN_SEMANTIC);
  const candidates  = filtered.length >= 5 ? filtered : rows;

  // Score each candidate
  const ranked: RankedCreator[] = candidates.map(row => {

    // first signal :Semantic score (0-1)
    const semantic = parseFloat(row.semantic_score);

    // second signal :Projected norm (0–1)
    // normalizing 60–100 values to 0–1
    const projected_norm = (row.projected_score - 60) / 40;

    // third signal :GMV norm (0–1) 
    // Normalise against $50k as a strong mid-tier benchmark.
    // Creators above $50k GMV get full credit.
    const gmv_norm = Math.min(row.total_gmv_30d / 50000, 1);

    // fourth signal :Demo match (0–1)
    const genderScore = row.major_gender === brandProfile.target_audience.gender
      ? (row.gender_pct / 10000)
      : 1 - (row.gender_pct / 10000);
    const ageScore = ageIOU(row.age_ranges, brandProfile.target_audience.age_ranges);
    const demo = genderScore * ageScore;

    // fifth signal :GPM norm (0–1)
    const perf = Math.min(row.gpm / 50, 1);


    // Weights tuned to balance vibe and commerce:
    // semantic  0.40 (40%) — topic relevance is the entry requirement
    // projected 0.30 (30%) — RoC's commerce signal
    // gmv_norm  0.20 (20%) — proven sales, explicit and interpretable
    // demo      0.07 (7%) — audience alignment tiebreaker
    // perf      0.03 (3%) — efficiency tiebreaker
    const raw =
      0.40 * semantic +
      0.30 * projected_norm +
      0.20 * gmv_norm +
      0.07 * demo +
      0.03 * perf;

    // Multipliers (applied after blend) ─────────

    // GMV hard gate — spec requirement, cannot be overridden
    // zero GMV: 0.3x  |  very low GMV (<1000): 0.6x  |  proven: 1.0x
    let multiplier = 1.0;
    if (row.total_gmv_30d === 0)       
      multiplier = 0.30;
    else if (row.total_gmv_30d < 1000) 
      multiplier = 0.60;

    // trying to align Category by penalising clear category mismatches
    // If none of the creator's tags match any brand industry then demote
    const hasIndustryMatch = brandProfile.industries.some(
      ind => row.content_style_tags.includes(ind)
    );
    if (!hasIndustryMatch) multiplier *= 0.70;

    const final_score = raw * multiplier;

    return {
      username:           row.username,
      bio:                row.bio,
      content_style_tags: row.content_style_tags,
      projected_score:    row.projected_score,
      metrics: {
        follower_count:  row.follower_count,
        total_gmv_30d:   row.total_gmv_30d,
        avg_views_30d:   row.avg_views_30d,
        engagement_rate: row.engagement_rate,
        gpm:             row.gpm,
        demographics: {
          major_gender: row.major_gender,
          gender_pct:   row.gender_pct,
          age_ranges:   row.age_ranges,
        },
      },
      scores: {
        semantic_score:  parseFloat(semantic.toFixed(4)),
        projected_score: row.projected_score,
        final_score:     parseFloat(final_score.toFixed(4)),
      },
    };
  });

  // sort and return top 10
  return ranked
    .sort((a, b) => b.scores.final_score - a.scores.final_score)
    .slice(0, 10);
}