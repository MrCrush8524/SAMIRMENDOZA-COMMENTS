import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useAppState } from "../lib/appState";
import "./LibraryScreen.css";

export function LibraryScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { manuscripts, importManuscript, deleteManuscript, openManuscript } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await importManuscript(file);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-button" onClick={onOpenDrawer} aria-label="Menu">
          &#9776;
        </button>
        <div className="topbar__title">Library</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={handleFileChange}
      />
      <button className="fab" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
        {isImporting ? "Importing..." : "+ Import manuscript"}
      </button>

      {manuscripts.length === 0 ? (
        <div className="library__empty">
          <p>Your library is empty</p>
          <p className="library__empty-sub">Import a plain-text manuscript (.txt) to get started.</p>
        </div>
      ) : (
        <ul className="library-list">
          {manuscripts.map((m) => (
            <li key={m.id} className="library-row">
              <button
                className="library-row__main"
                onClick={() => {
                  openManuscript(m);
                  navigate("/");
                }}
              >
                <div className="library-row__title">{m.title}</div>
                <div className="library-row__meta">
                  {m.wordCount} words &middot; ~{Math.round(m.durationEstimateSeconds / 60)} min
                </div>
              </button>
              <button
                className="library-row__delete"
                onClick={() => deleteManuscript(m.id)}
                aria-label={`Delete ${m.title}`}
              >
                &#128465;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
