import { Link } from "react-router-dom";
import "./Drawer.css";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
}

const ITEMS = [
  { path: "/", label: "Now Playing", icon: "▶" },
  { path: "/library", label: "Library", icon: "📚" },
  { path: "/voices", label: "Voices", icon: "🎙" },
  { path: "/settings", label: "Settings", icon: "⚙" }
];

export function Drawer({ open, onClose, currentPath }: DrawerProps) {
  return (
    <nav className={`drawer${open ? " drawer--open" : ""}`} aria-hidden={!open}>
      <div className="drawer__header">
        <div className="drawer__title">SMR</div>
        <div className="drawer__subtitle">Stories Made Real</div>
      </div>
      <ul className="drawer__list">
        {ITEMS.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`drawer__item${currentPath === item.path ? " drawer__item--active" : ""}`}
              onClick={onClose}
            >
              <span className="drawer__icon">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
