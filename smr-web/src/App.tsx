import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppStateProvider } from "./lib/appState";
import { Drawer } from "./components/Drawer";
import { NowPlayingScreen } from "./screens/NowPlayingScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { VoicesScreen } from "./screens/VoicesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import "./App.css";

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  return (
    <AppStateProvider>
      <div className="app-shell">
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} currentPath={location.pathname} />
        {drawerOpen && <div className="app-shell__scrim" onClick={() => setDrawerOpen(false)} />}
        <main className="app-shell__content">
          <Routes>
            <Route path="/" element={<NowPlayingScreen onOpenDrawer={() => setDrawerOpen(true)} />} />
            <Route path="/library" element={<LibraryScreen onOpenDrawer={() => setDrawerOpen(true)} />} />
            <Route path="/voices" element={<VoicesScreen onOpenDrawer={() => setDrawerOpen(true)} />} />
            <Route path="/settings" element={<SettingsScreen onOpenDrawer={() => setDrawerOpen(true)} />} />
          </Routes>
        </main>
      </div>
    </AppStateProvider>
  );
}
