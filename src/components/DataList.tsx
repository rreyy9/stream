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

        // Fetch first page
        let response = await fetchStreams(selectedCategory);
        allStreams.push(...response.data);
        setLoadingCount(allStreams.length);
        cursor = response.pagination.cursor;

        // Fetch remaining pages with live updates
        while (cursor && currentPage < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          response = await fetchStreams(selectedCategory, cursor);
          allStreams.push(...response.data);
          setLoadingCount(allStreams.length);
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

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-12 max-w-md w-full border border-white/20">
          <div className="text-center space-y-6">
            {/* Animated rings */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-white/30 absolute animate-ping"></div>
              <div className="w-20 h-20 rounded-full border-4 border-white/50 absolute animate-pulse"></div>
              <div className="w-16 h-16 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Loading Streams</h3>
              <p className="text-white/80 text-lg font-semibold">{loadingCount} streams loaded</p>
              <p className="text-white/60 text-sm">Please wait...</p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-12 max-w-md w-full border border-white/20">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Connection Error</h3>
              <p className="text-white/80">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white text-purple-600 font-bold py-3 px-6 rounded-xl hover:bg-white/90 transition shadow-lg"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header with glass effect */}
      <div className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6">
            {/* Logo and Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">StreamList</h1>
                  <p className="text-sm text-purple-300">{displayedStreams.length} live now</p>
                </div>
              </div>
            </div>
            
            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search streams or streamers..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={toggleSort}
                className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all flex items-center justify-center space-x-2"
              >
                <span className="font-semibold">Viewers</span>
                <svg className={`w-5 h-5 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {displayedStreams.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4">
              <svg className="w-10 h-10 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No streams found</h3>
            <p className="text-white/60">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedStreams.map((stream) => (
              <a
                key={`${stream.id}-${stream.user_name}`}
                href={`https://www.twitch.tv/${stream.user_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-white/10"
              >
                <div className="relative overflow-hidden">
                  <img 
                    src={stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')} 
                    alt={stream.title}
                    className="w-full h-44 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  
                  {/* Live badge */}
                  <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 shadow-lg">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    <span>LIVE</span>
                  </div>
                  
                  {/* Viewer count */}
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                    <span>{stream.viewer_count.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-white group-hover:text-purple-400 transition truncate">
                    {stream.user_name}
                  </h3>
                  <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">
                    {stream.title}
                  </p>
                  <span className="inline-block text-xs px-2 py-1 bg-purple-500/30 text-purple-300 rounded-lg">
                    {stream.game_name}
                  </span>
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