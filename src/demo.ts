import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { searchCreators } from './searchCreators';
import type { BrandProfile } from './types';

// Required deliverable — brand_smart_home profile
const brand_smart_home: BrandProfile = {
  id: 'brand_smart_home',
  industries: ['Home', 'Phones & Electronics'],
  target_audience: {
    gender: 'FEMALE',
    age_ranges: ['25-34', '35-44'],
  },
  gmv: 120000,
};

async function main() {
  const query = 'Affordable home decor for small apartments';

  console.log(`Query: "${query}"`);
  console.log(`Brand: ${brand_smart_home.id}\n`);
  console.log('Searching...\n');

  const results = await searchCreators(query, brand_smart_home);

  // Print to console
  results.forEach((creator, i) => {
    console.log(`${i + 1}. @${creator.username}`);
    console.log(`   Bio:       ${creator.bio.slice(0, 80)}...`);
    console.log(`   Tags:      ${creator.content_style_tags.join(', ')}`);
    console.log(`   GMV 30d:   $${creator.metrics.total_gmv_30d.toLocaleString()}`);
    console.log(`   GPM:       ${creator.metrics.gpm}`);
    console.log(`   Semantic:  ${creator.scores.semantic_score}`);
    console.log(`   Projected: ${creator.scores.projected_score}`);
    console.log(`   Final:     ${creator.scores.final_score}`);
    console.log('');
  });

  // Write output.json — required deliverable
  const outputPath = path.join(__dirname, '..', 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`output.json written to ${outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });