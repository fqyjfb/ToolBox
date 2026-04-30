import React, { useState, useRef, useEffect } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface PopupMenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  title?: string;
}

const PopupMenu: React.FC<PopupMenuProps> = ({ trigger, items, title }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsOpen(false);
  };

  return (
    <div className="popup-menu-container auth-popup" ref={menuRef}>
      <div
        className="popup-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'inline-block', cursor: 'pointer' }}
      >
        {trigger}
      </div>
      {isOpen && (
        <div className="popup-menu-window">
          {title && <legend className="popup-menu-title">{title}</legend>}
          <ul className="popup-menu-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className="popup-menu-item"
                  onClick={() => handleItemClick(item.onClick)}
                >
                  {item.icon && <span className="popup-menu-icon">{item.icon}</span>}
                  <span className="popup-menu-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <style>{`
        .popup-menu-container {
          position: relative;
          display: inline-block;
        }

        .popup-menu-window {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          padding: 0.625em 0.25em;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--color-border);
          transform: scale(0.8);
          visibility: visible;
          opacity: 1;
          transition: all 0.1s ease-in-out;
          z-index: 50;
          min-width: 120px;
        }

        .popup-menu-title {
          padding: 0.25em 1rem;
          margin: 0;
          color: var(--color-text-tertiary);
          font-size: 0.625em;
          text-transform: uppercase;
        }

        .popup-menu-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .popup-menu-item {
          outline: none;
          width: 100%;
          border: none;
          background: none;
          display: flex;
          align-items: center;
          color: var(--color-text-primary);
          font-size: 14px;
          padding: 0.375em 1rem;
          white-space: nowrap;
          border-radius: var(--radius-md);
          cursor: pointer;
          column-gap: 0.875em;
        }

        .popup-menu-item:hover {
          color: var(--color-bg-primary);
          background: var(--color-primary);
        }

        .popup-menu-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .popup-menu-label {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default PopupMenu;
