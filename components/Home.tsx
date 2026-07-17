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
      <div className="home">
        <div className="home__empty">
          <p className="home__empty-title">Chưa có bài hát nào</p>
          <p className="home__empty-sub">
            Dán một link TikTok ở tab Thư viện để bắt đầu vibe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      {heroTrack && (
        <div className="home-hero-shell">
          <section
            className="home-hero"
            style={{ backgroundImage: `url(${pickArt(heroTrack.title)})` }}
          >
            <div className="home-hero__scrim" aria-hidden />
            <div className="home-hero__content">
              <span className="home-hero__eyebrow">
                {recentlyPlayed[0] ? 'Tiếp tục nghe' : 'Gợi ý hôm nay'}
              </span>
              <h1 className="home-hero__title">{heroTrack.title}</h1>
              <p className="home-hero__author">{heroTrack.author}</p>
              <div className="home-hero__actions">
                <button
                  type="button"
                  className="home-hero__play"
                  onClick={handlePlayHero}
                >
                  <span className="home-hero__action-icon" aria-hidden>
                    <PlayIcon size={15} />
                  </span>
                  {currentTrack?.id === heroTrack.id && isPlaying
                    ? 'Đang phát'
                    : 'Phát ngay'}
                </button>
                <button
                  type="button"
                  className="home-hero__shuffle"
                  onClick={handleShuffleAll}
                >
                  <span className="home-hero__action-icon" aria-hidden>
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

      <section className="home-section">
        <div className="home-section__head">
          <h2 className="home-section__title">Playlist của bạn</h2>
        </div>
        <div className="home-playlist-grid">
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
        <section className="home-section">
          <div className="home-section__head">
            <h2 className="home-section__title">
              <TagIcon />
              Thể loại nhạc
            </h2>
            <p className="home-section__subtitle">Khám phá theo thể loại</p>
          </div>
          <div className="home-category-grid">
            {categories
              .filter((c) => c.count && c.count > 0)
              .slice(0, 10)
              .map((c) => (
                <button
                  type="button"
                  key={c.slug}
                  className="home-category-card"
                  onClick={() => {
                    withViewTransition(() => selectCategory(c.slug));
                    onOpenLibrary?.();
                  }}
                >
                  <span className="home-category-card__name">{c.name}</span>
                  <span className="home-category-card__count">
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
        subtitle="Vừa tải về từ TikTok"
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
    <section className="home-section">
      <div className="home-section__head">
        <h2 className="home-section__title">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="home-section__subtitle">{subtitle}</p>}
      </div>
      <div className="home-row">{children}</div>
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
      className={`track-card${active ? ' is-active' : ''}`}
      onClick={onPlay}
    >
      <span className="track-card__shell">
        <span
          className="track-card__art"
          style={{ backgroundImage: `url(${art})` }}
        >
          <span className="track-card__play" aria-hidden>
            {active && playing ? <EqDots /> : <PlayIcon size={18} />}
          </span>
        </span>
      </span>
      <span className="track-card__title">{track.title}</span>
      <span className="track-card__author">{track.author}</span>
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
    <Link href={href} className="playlist-card">
      <span className="playlist-card__inner">
        <span
          className="playlist-card__art"
          style={{ backgroundImage: `url(${pickArt(name)})` }}
        />
        <span className="playlist-card__scrim" aria-hidden />
        <span className="playlist-card__body">
          <span className="playlist-card__name">{name}</span>
          {count != null && (
            <span className="playlist-card__count">{count} bài</span>
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
