/**
 * Auto-generated Supabase types.
 * Regenerate with: npm run supabase:gen-types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          device_id: string;
          locale: "zh-CN" | "en-GB";
          region: "CN" | "UK" | "NORDIC" | "OTHER";
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          locale?: "zh-CN" | "en-GB";
          region?: "CN" | "UK" | "NORDIC" | "OTHER";
          created_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          locale?: "zh-CN" | "en-GB";
          region?: "CN" | "UK" | "NORDIC" | "OTHER";
          created_at?: string;
        };
      };
      check_ins: {
        Row: {
          id: string;
          user_id: string;
          level: number;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          level: number;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          level?: number;
          date?: string;
          created_at?: string;
        };
      };
      vent_logs: {
        Row: {
          id: string;
          user_id: string;
          char_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          char_count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          char_count?: number;
          created_at?: string;
        };
      };
      quips: {
        Row: {
          id: string;
          text: string;
          locale: "zh-CN" | "en-GB";
          created_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          locale: "zh-CN" | "en-GB";
          created_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          locale?: "zh-CN" | "en-GB";
          created_at?: string;
        };
      };
    };
    Functions: {
      get_global_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_regional_stats: {
        Args: { target_region: "CN" | "UK" | "NORDIC" | "OTHER" };
        Returns: Json;
      };
      get_all_regional_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_random_quip: {
        Args: { target_locale?: "zh-CN" | "en-GB" };
        Returns: Json;
      };
    };
    Enums: {
      locale_enum: "zh-CN" | "en-GB";
      region_enum: "CN" | "UK" | "NORDIC" | "OTHER";
    };
  };
};
