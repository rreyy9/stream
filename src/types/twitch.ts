/** Trimmed stream shape returned by /api/streams (only the fields the UI uses). */
export interface Stream {
  id: string;
  user_login: string;
  user_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  game_name: string;
  is_mature: boolean;
  tags: string[];
}

export interface StreamsResponse {
  streams: Stream[];
  /** Pass back as `cursor` to load the next chunk; null when there are no more streams. */
  cursor: string | null;
  fetchedAt: string;
  /** True when Twitch failed and the server returned its last good result. */
  stale: boolean;
}

export interface GameCategory {
  id: string;
  name: string;
  /** Template URL with {width}x{height} placeholders. */
  box_art_url?: string;
}
