'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { withViewTransition } from '../lib/viewTransition';
import Home from './Home';
import MiniPlayer from './MiniPlayer';
import MobileNav, { type MobileTab } from './MobileNav';
import MobileSidebar from './MobileSidebar';
import PlayerPanel from './PlayerPanel';
import PlaylistView from './PlaylistView';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  // Remember the last browsing tab so the player sheet can slide back to it
  // (swipe-down / Esc / backdrop tap) rather than always landing on Home.
  const lastContentTab = useRef<MobileTab>('home');
  const { currentTrack, view, goHome, setView } = useAppStore();

  // A shared link (?pl=&track=) flips the store straight to 'library' on
  // load — mirror that on the mobile tab bar so it doesn't still say "Home".
  useEffect(() => {
    if (view === 'library') setMobileTab((t) => (t === 'home' ? 'tracks' : t));
  }, [view]);

  const handleTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'home') withViewTransition(goHome);
    else if (tab === 'tracks') withViewTransition(() => setView('library'));
  };

  const isContentTab = mobileTab === 'tracks' || mobileTab === 'home';
  if (isContentTab) lastContentTab.current = mobileTab;

  return (
    <>
      <div className="app">
        <Sidebar />
        <div className={`main-wrap${isContentTab ? '' : ' mobile-hidden'}`}>
          {view === 'home' ? (
            <Home onOpenLibrary={() => setMobileTab('tracks')} />
          ) : (
            <PlaylistView />
          )}
        </div>
        <PlayerPanel
          mobileTab={mobileTab}
          onClosePlayer={() => setMobileTab(lastContentTab.current)}
        />
      </div>
      <MiniPlayer
        mobileTab={mobileTab}
        onOpenPlayer={() => setMobileTab('player')}
      />
      <MobileSidebar
        visible={mobileTab === 'playlists'}
        onClose={() => setMobileTab(lastContentTab.current)}
      />
      <MobileNav
        activeTab={mobileTab}
        onChange={handleTabChange}
        hasTrack={!!currentTrack}
      />
    </>
  );
}
