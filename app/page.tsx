'use client';

import { useState } from 'react';
import { AppStoreProvider, useAppStore } from '../hooks/useAppStore';
import Sidebar from '../components/Sidebar';
import PlaylistView from '../components/PlaylistView';
import PlayerPanel from '../components/PlayerPanel';
import MiniPlayer from '../components/MiniPlayer';
import MobileNav, { type MobileTab } from '../components/MobileNav';
import MobileSidebar from '../components/MobileSidebar';
import './components.css';

function AppShell() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('tracks');
  const { currentTrack } = useAppStore();

  return (
    <>
      <div className="app">
        <Sidebar />
        <div className={`main-wrap${mobileTab !== 'tracks' ? ' mobile-hidden' : ''}`}>
          <PlaylistView />
        </div>
        <PlayerPanel mobileTab={mobileTab} />
      </div>
      <MiniPlayer mobileTab={mobileTab} onOpenPlayer={() => setMobileTab('player')} />
      <MobileSidebar
        visible={mobileTab === 'playlists'}
        onClose={() => setMobileTab('tracks')}
      />
      <MobileNav
        activeTab={mobileTab}
        onChange={setMobileTab}
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
