import axios from 'axios';
import type { TwitchStreamsResponse } from '../types/twitch';

const API_BASE = '';  // Always use relative path (same domain)

export const fetchStreams = async (
  gameId: string, 
  cursor?: string
): Promise<TwitchStreamsResponse> => {
  const params = new URLSearchParams({ game_id: gameId });
  
  if (cursor) {
    params.append('cursor', cursor);
  }

  const response = await axios.get<TwitchStreamsResponse>(
    `${API_BASE}/api/streams?${params}`
  );

  return response.data;
};

export const fetchAllStreams = async (gameId: string) => {
  const allStreams: TwitchStreamsResponse['data'] = [];
  let cursor: string | undefined = undefined;
  let currentPage = 0;

  // Fetch first page
  let response = await fetchStreams(gameId);
  allStreams.push(...response.data);
  cursor = response.pagination.cursor;

  // Fetch remaining pages
  while (cursor && currentPage < 10) { // Limit to 10 pages (1000 streams)
    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
    
    response = await fetchStreams(gameId, cursor);
    allStreams.push(...response.data);
    cursor = response.pagination.cursor;
    currentPage++;

    if (allStreams.length >= 1000) {
      break;
    }
  }

  // Remove duplicates
  const uniqueStreams = Array.from(
    new Map(allStreams.map(s => [s.id, s])).values()
  );

  return uniqueStreams;
};