import { useState, useEffect } from 'react';

interface TwitchStream {
  id: string;
  user_id: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  is_mature: boolean;
}

interface TwitchStreamsResponse {
  data: TwitchStream[];
  pagination: {
    cursor?: string;
  };
}

interface GameCategory {
  id: string;
  name: string;
}

const categories: GameCategory[] = [
  { id: '18122', name: 'World of Warcraft' },
  { id: '509658', name: 'Just Chatting' },
];

const fetchStreams = async (
  gameId: string, 
  cursor?: string
): Promise<TwitchStreamsResponse> => {
  const params = new URLSearchParams({ game_id: gameId });
  
  if (cursor) {
    params.append('cursor', cursor);
  }

  const response = await fetch(`/api/streams?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch streams');
  }

  return await response.json();
};

const DataList = () => {
  const [streams, setStreams] = useState<TwitchStream[]>([]);
  const [displayedStreams, setDisplayedStreams] = useState<TwitchStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState('18122');
  const [loadingCount, setLoadingCount] = useState(0);

  useEffect(() => {
    const loadStreams = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setStreams([]);
        setDisplayedStreams([]);
        setLoadingCount(0);
        
        const allStreams: TwitchStream[] = [];
        let cursor: string | undefined = undefined;
        let currentPage = 0;

        let response = await fetchStreams(selectedCategory);
        allStreams.push(...response.data);
        setLoadingCount(allStreams.length);
        cursor = response.pagination.cursor;

        while (cursor && currentPage < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          response = await fetchStreams(selectedCategory, cursor);
          allStreams.push(...response.data);
          setLoadingCount(allStreams.length);
          cursor = response.pagination.cursor;
          currentPage++;

          if (allStreams.length >= 1000) break;
        }

        const uniqueStreams = Array.from(
          new Map(allStreams.map(s => [s.id, s])).values()
        );

        setStreams(uniqueStreams);
        setDisplayedStreams(uniqueStreams);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load streams');
      } finally {
        setIsLoading(false);
      }
    };

    loadStreams();
  }, [selectedCategory]);

  useEffect(() => {
    let filtered = [...streams];

    if (searchTerm) {
      filtered = filtered.filter(stream => 
        stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stream.user_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.viewer_count - a.viewer_count;
      }
      return a.viewer_count - b.viewer_count;
    });

    setDisplayedStreams(filtered);
  }, [streams, searchTerm, sortOrder]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full border border-gray-700">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-900 rounded-full">
              <svg className="w-8 h-8 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white">Loading streams...</h3>
            <p className="text-gray-400">{loadingCount} streams loaded</p>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all duration-300 animate-pulse" style={{ width: '50%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full border border-gray-700">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-900 rounded-full">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white">Error loading streams</h3>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 m-0 p-0 overflow-hidden flex flex-col" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Header - Fixed to top, full width */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-800 shadow-lg border-b border-gray-700" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="px-1 py-4" style={{ width: '100%', maxWidth: '100%' }}>
          <div className="space-y-4">
            {/* Title Row */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Live Streams</h1>
              <span className="text-gray-400 text-sm">{displayedStreams.length} streams</span>
            </div>
            
            {/* Categories Row */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category.id
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Search and Sort Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search streams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-gray-400"
              />
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-6 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-sm font-medium text-gray-300 whitespace-nowrap"
              >
                Sort: Viewers {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable area with padding for fixed header */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="pt-56 sm:pt-52 md:pt-48 px-1 py-4" style={{ width: '100%', maxWidth: '100%' }}>
          {displayedStreams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No streams found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {displayedStreams.map((stream) => (
                <a
                  key={`${stream.id}-${stream.user_name}`}
                  href={`https://www.twitch.tv/${stream.user_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-gray-800 rounded-lg shadow-lg hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-1 hover:ring-2 hover:ring-purple-500 block overflow-hidden"
                >
                  {/* Thumbnail Container */}
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <img
                      src={stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360')}
                      alt={stream.title}
                      className="absolute top-0 left-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* LIVE badge */}
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold uppercase">
                      Live
                    </div>
                    {/* Viewer count */}
                    <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white px-2 py-1 rounded text-xs font-medium">
                      {stream.viewer_count.toLocaleString()}
                    </div>
                  </div>
                  
                  {/* Stream Info */}
                  <div className="p-3 space-y-1.5">
                    <h3 className="font-bold text-white group-hover:text-purple-400 transition truncate text-base">
                      {stream.user_name}
                    </h3>
                    <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed min-h-[3rem]">
                      {stream.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate pt-1">
                      {stream.game_name}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DataList;