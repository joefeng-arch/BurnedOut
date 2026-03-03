/**
 * API response types matching the OpenAPI spec (docs/api/openapi.json)
 */

export type Locale = "zh-CN" | "en-GB";
export type Region = "CN" | "UK" | "NORDIC" | "OTHER";
export type BurnoutLevel = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  device_id: string;
  locale: Locale;
  region: Region;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  level: BurnoutLevel;
  date: string;
  created_at: string;
}

export interface VentResponse {
  id: string;
  char_count: number;
  quip: string;
  created_at: string;
}

export interface LevelDistribution {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
}

export interface GlobalStats {
  total_users: number;
  today_check_ins: number;
  today_vents: number;
  avg_level: number;
  level_distribution: LevelDistribution;
  updated_at: string;
}

export interface RegionalStats {
  region: Region;
  today_check_ins: number;
  today_vents: number;
  avg_level: number;
  level_distribution: LevelDistribution;
  updated_at: string;
}

export interface Quip {
  id: string;
  text: string;
  locale: Locale;
}

export interface PaginatedCheckIns {
  data: CheckIn[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  message: string;
}
