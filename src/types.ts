export type Industry =
  | 'Health'
  | 'Food & Beverage'
  | 'Beauty'
  | 'Fashion'
  | "Fashion (Men's)"
  | 'Toys & Hobbies'
  | 'Home'
  | 'Baby & Maternity'
  | 'Phones & Electronics'
  | 'Sports & Outdoors'
  | 'Tools & Hardware'
  | 'Pet'
  | 'Books'
  | 'Computer & Office Equipment';

export interface Creator {
  username: string;
  bio: string;
  content_style_tags: Industry[];
  projected_score: number;        // pre-computed by RoC, range 60–100
  metrics: {
    follower_count: number;
    total_gmv_30d: number;
    avg_views_30d: number;
    engagement_rate: number;
    gpm: number;
    demographics: {
      major_gender: 'MALE' | 'FEMALE';
      gender_pct: number;
      age_ranges: string[];
    };
  };
}

export interface BrandProfile {
  id: string;
  industries: Industry[];
  target_audience: {
    gender: 'MALE' | 'FEMALE';
    age_ranges: string[];
  };
  gmv: number;
}

export interface RankedCreator extends Creator {
  scores: {
    semantic_score: number;   // cosine similarity (0–1), computed by participant
    projected_score: number;  // from data (60–100), passed through
    final_score: number;      // participant's hybrid formula output
  };
}
