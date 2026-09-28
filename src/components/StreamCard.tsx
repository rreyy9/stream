import { memo } from 'react';
import type { Stream } from '../types/twitch';

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

function formatUptime(startedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

interface Props {
  stream: Stream;
  now: number;
  isFavorite: boolean;
  activeTag: string;
  onToggleFavorite: (login: string) => void;
  onTagClick: (tag: string) => void;
}

export const StreamCard = memo(function StreamCard({ stream, now, isFavorite, activeTag, onToggleFavorite, onTagClick }: Props) {
  const thumbnail = stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248');

  return (
    <article
      // content-visibility lets the browser skip layout/paint for off-screen cards,
      // which keeps large grids smooth without a virtualization library.
      className={`group relative flex flex-col overflow-hidden rounded-lg bg-gray-800 shadow-lg ring-purple-500 transition duration-200 [contain-intrinsic-size:auto_340px] [content-visibility:auto] hover:-translate-y-1 hover:shadow-purple-500/30 hover:ring-2 has-[a:focus-visible]:ring-2 ${
        isFavorite ? 'outline-1 outline-amber-400/60' : ''
      }`}
    >
      <a href={`https://www.twitch.tv/${stream.user_login}`} target="_blank" rel="noopener noreferrer" className="block outline-none">
        <div className="relative aspect-video bg-gray-700">
          <img
            src={thumbnail}
            alt=""
            width={440}
            height={248}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white uppercase">Live</span>
            {stream.is_mature && <span className="rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-amber-300">18+</span>}
          </div>
          <span
            className="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-white"
            title={`${stream.viewer_count.toLocaleString()} viewers`}
          >
            {compact.format(stream.viewer_count)} viewers
          </span>
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-2 py-0.5 text-xs text-gray-200">
            {formatUptime(stream.started_at, now)}
          </span>
        </div>

        <div className="space-y-1.5 px-3 pt-3 pb-2">
          <h3 className="truncate text-base font-bold text-white transition group-hover:text-purple-400">{stream.user_name}</h3>
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-gray-300" title={stream.title}>
            {stream.title}
          </p>
          <p className="truncate text-xs text-gray-400">
            {stream.game_name} · <span className="uppercase">{stream.language}</span>
          </p>
        </div>
      </a>

      {stream.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-3">
          {stream.tags.slice(0, 4).map((tag) => {
            const active = tag.toLowerCase() === activeTag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(active ? '' : tag)}
                aria-pressed={active}
                title={active ? 'Clear tag filter' : `Show only "${tag}" streams`}
                className={`max-w-full truncate rounded-full px-2 py-0.5 text-xs ${
                  active ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleFavorite(stream.user_login)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${stream.user_name} from favorites` : `Add ${stream.user_name} to favorites`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites (pins to top)'}
        className={`absolute top-2 right-2 rounded-full bg-black/70 p-1.5 transition hover:bg-black/90 focus-visible:opacity-100 ${
          isFavorite ? 'text-amber-400' : 'text-white opacity-80 hover:text-amber-300 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinejoin="round" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      </button>
    </article>
  );
});
