import type { ExperienceLevel } from '@kartapp/domain';

export type Locale = 'en' | 'ro';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  home_city_id: string | null;
  bio: string;
  avatar_path: string | null;
  locale: Locale;
  role: 'user' | 'admin';
  terms_accepted_at: string | null;
  onboarded_at: string | null;
}

export interface PublicProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_path: string | null;
  bio: string;
  home_city_id: string | null;
  age: number | null;
  total_points: number;
  sessions_raced: number;
  tracks_raced: number;
  wins: number;
  rank_tier_id: number;
  created_at: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  timezone: string;
}

export interface TrackSummary {
  id: string;
  name: string;
  city_id: string;
}

export interface TrackExperience {
  user_id: string;
  track_id: string;
  level: ExperienceLevel;
  best_lap_ms: number | null;
  sessions_count: number;
  tracks?: { name: string } | null;
}

export interface RankTier {
  id: number;
  key: string;
  min_points: number;
  color: string;
}
