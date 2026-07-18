'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { pickArt, pickArtAt } from '../lib/artwork';
import type { Track } from '../lib/types';
import { withViewTransition } from '../lib/viewTransition';
import {
  ClockIcon,
  ListMusicIcon,
  PlayIcon,
  ShuffleIcon,
  TagIcon,
} from './icons';

interface HomeProps {
  /** Fires after navigating to a playlist/track list — lets the mobile shell flip to the Library tab. */
  onOpenLibrary?: () => void;
}

/**
 * Discover dashboard — the personal "front page" of the library instead of
 * dropping straight into a bare track list. Sections are built entirely from
 * data already in the store (favorites, recency, local play history); the
 * neon photography is decorative only, borrowed from the Stitch mockups
 * since crawled TikTok covers rarely have real usable art (see Cover.tsx).
 */
export default function Home({ onOpenLibrary }: HomeProps) {
  const {
    tracks,
    playlists,
    categories,
    favorites,
    recentlyPlayed,
    currentTrack,
    isPlaying,
    playTrack,
    playAll,
    setShuffle,
    selectCategory,
  } = useAppStore();

  const heroTrack = useMemo<Track | null>(() => {
    if (recentlyPlayed[0]) return recentlyPlayed[0];
    if (tracks.length === 0) return null;
    // No history yet — pick a track that's stable for the whole day rather
    // than reshuffling on every render.
    const day = Math.floor(Date.now() / 86_400_000);
    return tracks[day % tracks.length];
  }, [recentlyPlayed, tracks]);

  const favoriteTracks = useMemo(
    () => tracks.filter((t) => favorites.has(t.id)).slice(0, 12),
    [tracks, favorites],
  );

  const recentlyAdded = useMemo(
    () => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12),
    [tracks],
  );

  const handlePlayHero = () => {
    if (heroTrack) playTrack(heroTrack);
  };

  const handleShuffleAll = () => {
    setShuffle(true);
    playAll();
  };

  if (tracks.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-11 overflow-y-auto px-[clamp(24px,3vw,48px)] pb-14 pt-[calc(28px+env(safe-area-inset-top))] max-[640px]:gap-8 max-[640px]:px-4 max-[640px]:pb-[calc(var(--bottom-stack)+24px)] max-[640px]:pt-[calc(16px+env(safe-area-inset-top))]">
        <div className="m-auto p-10 text-center">
          <p className="mb-2 font-display text-xl font-extrabold">
            Chưa có bài hát nào
          </p>
          <p className="text-sm text-muted">
            Dán một link TikTok hoặc YouTube ở tab Thư viện để bắt đầu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-11 overflow-y-auto px-[clamp(24px,3vw,48px)] pb-14 pt-[calc(28px+env(safe-area-inset-top))] max-[640px]:gap-8 max-[640px]:px-4 max-[640px]:pb-[calc(var(--bottom-stack)+24px)] max-[640px]:pt-[calc(16px+env(safe-area-inset-top))]">
      {heroTrack && (
        <div className="rounded-[26px] bg-[linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.025)_48%,rgba(0,221,214,0.1))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.24)] max-[640px]:rounded-[21px] max-[640px]:p-1">
          <section
            className="relative isolate flex min-h-80 items-end overflow-hidden rounded-[20px] bg-cover bg-center max-[640px]:min-h-[284px] max-[640px]:rounded-[17px]"
            style={{ backgroundImage: `url(${pickArt(heroTrack.title)})` }}
          >
            <div
              className="absolute inset-0 z-0 bg-[linear-gradient(0deg,var(--bg)_8%,rgba(10,10,10,0.35)_55%,rgba(10,10,10,0.1)_100%)]"
              aria-hidden
            />
            <div className="relative z-[1] max-w-[640px] p-[clamp(28px,4vw,48px)] max-[640px]:w-full max-[640px]:p-5">
              <span className="mb-3.5 inline-block rounded-full bg-accent px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-canvas">
                {recentlyPlayed[0] ? 'Tiếp tục nghe' : 'Gợi ý hôm nay'}
              </span>
              <h1 className="mb-1.5 line-clamp-2 font-display text-[32px] leading-[1.15] font-black text-white max-[640px]:text-2xl">
                {heroTrack.title}
              </h1>
              <p className="mb-6 text-sm text-ink-secondary max-[640px]:mb-4">
                {heroTrack.author}
              </p>
              <div className="flex flex-nowrap gap-2.5 max-[640px]:gap-2">
                <button
                  type="button"
                  className="group inline-flex cursor-pointer items-center gap-[9px] rounded-full border-0 bg-linear-to-br from-accent to-tertiary py-[7px] pr-[18px] pl-2 text-sm font-bold text-[#00201e] shadow-accent transition-[filter,transform] duration-[420ms] ease-out-app hover:brightness-110 active:scale-[0.98] max-[640px]:gap-[7px] max-[640px]:py-1.5 max-[640px]:pr-3 max-[640px]:pl-1.5 max-[640px]:text-[12.5px] max-[640px]:whitespace-nowrap"
                  onClick={handlePlayHero}
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgba(0,32,30,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-[480ms] ease-out-app group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-[1.04] max-[640px]:size-[30px]"
                    aria-hidden
                  >
                    <PlayIcon size={15} />
                  </span>
                  {currentTrack?.id === heroTrack.id && isPlaying
                    ? 'Đang phát'
                    : 'Phát ngay'}
                </button>
                <button
                  type="button"
                  className="group inline-flex cursor-pointer items-center gap-[9px] rounded-full border-0 bg-white/10 py-[7px] pr-[18px] pl-2 text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[filter,transform] duration-[420ms] ease-out-app hover:brightness-110 active:scale-[0.98] max-[640px]:gap-[7px] max-[640px]:py-1.5 max-[640px]:pr-3 max-[640px]:pl-1.5 max-[640px]:text-[12.5px] max-[640px]:whitespace-nowrap"
                  onClick={handleShuffleAll}
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-[480ms] ease-out-app group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-[1.04] max-[640px]:size-[30px]"
                    aria-hidden
                  >
                    <ShuffleIcon size={15} />
                  </span>
                  Phát ngẫu nhiên
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {recentlyPlayed.length > 0 && (
        <HomeRow
          icon={<ClockIcon size={16} />}
          title="Tiếp tục nghe"
          subtitle="Những bài bạn vừa nghe"
        >
          {recentlyPlayed.map((t, i) => (
            <TrackCard
              key={t.id}
              track={t}
              art={pickArtAt(t.title, i)}
              active={currentTrack?.id === t.id}
              playing={isPlaying}
              onPlay={() => playTrack(t)}
            />
          ))}
        </HomeRow>
      )}

      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-accent">
            Playlist của bạn
          </h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4 max-[640px]:grid-cols-2 max-[640px]:gap-2.5">
          <PlaylistCard
            name="Tất cả bài hát"
            count={tracks.length}
            href="/library"
          />
          <PlaylistCard
            name="Yêu thích"
            count={favorites.size}
            href="/library/favorites"
          />
          {playlists
            .filter((p) => p.id !== 1)
            .map((p) => (
              <PlaylistCard
                key={p.id}
                name={p.name}
                count={p.trackCount}
                href={`/library/${p.id}`}
              />
            ))}
        </div>
      </section>

      {favoriteTracks.length > 0 && (
        <HomeRow title="Yêu thích của bạn" subtitle="Những bài bạn đã thả tim">
          {favoriteTracks.map((t, i) => (
            <TrackCard
              key={t.id}
              track={t}
              art={pickArtAt(t.title, i + 3)}
              active={currentTrack?.id === t.id}
              playing={isPlaying}
              onPlay={() => playTrack(t)}
            />
          ))}
        </HomeRow>
      )}

      {categories.length > 0 && (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-accent">
              <TagIcon />
              Thể loại nhạc
            </h2>
            <p className="text-xs text-muted">Khám phá theo thể loại</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.count && c.count > 0)
              .slice(0, 10)
              .map((c) => (
                <button
                  type="button"
                  key={c.slug}
                  className="inline-flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-control border-0 bg-surface px-[18px] py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background,box-shadow,transform] duration-[480ms] ease-out-app hover:-translate-y-0.5 hover:bg-surface-2 hover:shadow-[inset_0_0_0_1px_rgba(0,221,214,0.26),inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(0,0,0,0.18)] active:scale-[0.97]"
                  onClick={() => {
                    withViewTransition(() => selectCategory(c.slug));
                    onOpenLibrary?.();
                  }}
                >
                  <span className="text-sm font-bold text-ink">{c.name}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {c.count} bài
                  </span>
                </button>
              ))}
          </div>
        </section>
      )}

      <HomeRow
        icon={<ListMusicIcon size={16} />}
        title="Mới thêm gần đây"
        subtitle="Vừa thêm gần đây"
      >
        {recentlyAdded.map((t, i) => (
          <TrackCard
            key={t.id}
            track={t}
            art={pickArtAt(t.title, i + 6)}
            active={currentTrack?.id === t.id}
            playing={isPlaying}
            onPlay={() => playTrack(t)}
          />
        ))}
      </HomeRow>
    </div>
  );
}

function HomeRow({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-accent">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      <div className="-m-0.5 flex gap-4 overflow-x-auto p-0.5 pb-2">
        {children}
      </div>
    </section>
  );
}

function TrackCard({
  track,
  art,
  active,
  playing,
  onPlay,
}: {
  track: Track;
  art: string;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className="home-card-reveal group flex w-[150px] shrink-0 cursor-pointer flex-col gap-[7px] border-0 bg-transparent p-0 text-left text-inherit"
      onClick={onPlay}
    >
      <span
        className={`block size-[150px] rounded-panel bg-[linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.025))] p-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_34px_rgba(0,0,0,0.18)] transition-[box-shadow,transform] duration-[480ms] ease-out-app group-hover:-translate-y-1 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_44px_rgba(0,0,0,0.28)] group-active:-translate-y-px group-active:scale-[0.98]${active ? ' shadow-[inset_0_0_0_1px_rgba(0,221,214,0.7),0_0_0_1px_rgba(0,221,214,0.35),0_0_20px_var(--accent-glow)]' : ''}`}
      >
        <span
          className="relative block size-full overflow-hidden rounded-control bg-surface-2 bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          style={{ backgroundImage: `url(${art})` }}
        >
          <span
            className={`absolute right-2 bottom-2 flex size-[34px] translate-y-1.5 items-center justify-center rounded-full bg-accent text-[#00201e] opacity-0 transition-[opacity,transform] duration-[420ms] ease-out-app group-hover:translate-y-0 group-hover:opacity-100${active ? ' translate-y-0 opacity-100' : ''}`}
            aria-hidden
          >
            {active && playing ? <EqDots /> : <PlayIcon size={18} />}
          </span>
        </span>
      </span>
      <span className="truncate text-[13px] font-bold">{track.title}</span>
      <span className="truncate font-mono text-[11px] text-muted">
        {track.author}
      </span>
    </button>
  );
}

function PlaylistCard({
  name,
  count,
  href,
}: {
  name: string;
  count?: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="home-card-reveal group relative isolate block aspect-[16/7] cursor-pointer rounded-panel border-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.025))] p-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_46px_rgba(0,0,0,0.2)] transition-[box-shadow,transform] duration-[550ms] ease-out-app hover:-translate-y-[3px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_56px_rgba(0,0,0,0.3)] active:-translate-y-px active:scale-[0.985] max-[640px]:aspect-[6/5] max-[640px]:rounded-[14px] max-[640px]:p-1"
    >
      <span className="relative block size-full overflow-hidden rounded-control shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] max-[640px]:rounded-[10px]">
        <span
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[620ms] ease-out-app group-hover:scale-[1.06]"
          style={{ backgroundImage: `url(${pickArt(name)})` }}
        />
        <span
          className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,10,10,0.9)_15%,rgba(10,10,10,0.1)_70%)]"
          aria-hidden
        />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-left max-[640px]:p-2.5">
          <span className="truncate text-sm font-bold text-white max-[640px]:text-[13px]">
            {name}
          </span>
          {count != null && (
            <span className="font-mono text-[11px] text-ink-secondary">
              {count} bài
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

function EqDots() {
  return (
    <span className="eq-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
