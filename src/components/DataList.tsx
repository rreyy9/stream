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
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Loading Streams...
          </div>
          <div style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1rem' }}>
            {loadingCount} streams loaded
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#8b5cf6',
              width: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '1rem' }}>
            Error
          </div>
          <div style={{ color: '#6b7280', marginBottom: '1rem' }}>{error}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem',
        zIndex: 50
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Live Streams</h1>
            <span style={{ color: '#6b7280' }}>{displayedStreams.length} streams</span>
          </div>

          {/* Categories */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  backgroundColor: selectedCategory === category.id ? '#8b5cf6' : '#f3f4f6',
                  color: selectedCategory === category.id ? 'white' : '#374151'
                }}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Search and Sort */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search streams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Viewers {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>

      {/* Stream Grid */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem' }}>
        {displayedStreams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            No streams found
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {displayedStreams.map((stream) => (
              <a
                key={`${stream.id}-${stream.user_name}`}
                href={`https://www.twitch.tv/${stream.user_name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  display: 'block'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                {/* Thumbnail */}
                <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', backgroundColor: '#000' }}>
                  <img
                    src={stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248')}
                    alt={stream.title}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  {/* LIVE badge */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    LIVE
                  </div>
                  {/* Viewer count */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem'
                  }}>
                    {stream.viewer_count.toLocaleString()} viewers
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#111827' }}>
                    {stream.user_name}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '0.5rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {stream.title}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#9ca3af'
                  }}>
                    {stream.game_name}
                  </div>
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