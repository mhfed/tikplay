'use client';

import { useEffect, useState } from 'react';
import { AppStoreProvider, useAppStore } from '../hooks/useAppStore';
import Sidebar from '../components/Sidebar';
import Home from '../components/Home';
import PlaylistView from '../components/PlaylistView';
import PlayerPanel from '../components/PlayerPanel';
import MiniPlayer from '../components/MiniPlayer';
import MobileNav, { type MobileTab } from '../components/MobileNav';
import MobileSidebar from '../components/MobileSidebar';
import './components.css';

function AppShell() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  const { currentTrack, view, goHome, setView } = useAppStore();

  // A shared link (?pl=&track=) flips the store straight to 'library' on
  // load — mirror that on the mobile tab bar so it doesn't still say "Home".
  useEffect(() => {
    if (view === 'library') setMobileTab((t) => (t === 'home' ? 'tracks' : t));
  }, [view]);

  const handleTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'home') goHome();
    else if (tab === 'tracks') setView('library');
  };

  const isContentTab = mobileTab === 'tracks' || mobileTab === 'home';

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
        <PlayerPanel mobileTab={mobileTab} />
      </div>
      <MiniPlayer mobileTab={mobileTab} onOpenPlayer={() => setMobileTab('player')} />
      <MobileSidebar
        visible={mobileTab === 'playlists'}
        onClose={() => setMobileTab(view === 'home' ? 'home' : 'tracks')}
      />
      <MobileNav
        activeTab={mobileTab}
        onChange={handleTabChange}
        hasTrack={!!currentTrack}
      />
    </>
  );
}

export default function Page() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  );
}
