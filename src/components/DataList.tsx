import { useState, useEffect } from 'react';
import { fetchStreams } from '../services/api';
import type { TwitchStream, GameCategory } from '../types/twitch';

const categories: GameCategory[] = [
  { id: '18122', name: 'World of Warcraft' },
  { id: '21779', name: 'League of Legends' },
  { id: '27471', name: 'Minecraft' },
  { id: '516575', name: 'VALORANT' },
  { id: '33214', name: 'Fortnite' },
  { id: '509658', name: 'Just Chatting' },
  { id: '32982', name: 'Grand Theft Auto V' },
  { id: '511224', name: 'Apex Legends' }
];

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
              <svg className="w-8 h-8 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Loading streams...</h3>
            <p className="text-gray-600">{loadingCount} streams loaded</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all duration-300 animate-pulse" style={{ width: '50%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Error loading streams</h3>
            <p className="text-gray-600">{error}</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-4">
            {/* Title */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Live Streams</h1>
              <span className="text-gray-600">{displayedStreams.length} streams</span>
            </div>
            
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedCategory === category.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search streams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Sort: Viewers {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {displayedStreams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No streams found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedStreams.map((stream) => (
              <a
                key={`${stream.id}-${stream.user_name}`}
                href={`https://www.twitch.tv/${stream.user_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-lg shadow hover:shadow-lg transition-all duration-200 hover:-translate-y-1 block"
              >
                {/* Thumbnail Container with proper aspect ratio */}
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <img
                    src={stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}
                    alt={stream.title}
                    className="absolute top-0 left-0 w-full h-full object-cover rounded-t-lg"
                  />
                  {/* LIVE badge */}
                  <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                    LIVE
                  </div>
                  {/* Viewer count */}
                  <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-0.5 rounded text-xs">
                    {stream.viewer_count.toLocaleString()} viewers
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-3 space-y-1">
                  <h3 className="font-semibold text-gray-900 hover:text-purple-600 transition truncate">
                    {stream.user_name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {stream.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stream.game_name}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataList;