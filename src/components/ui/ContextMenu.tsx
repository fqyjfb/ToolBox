import React, { useEffect, useCallback, useState, useRef } from 'react';

export interface SubMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

export interface ContextMenuItem {
  id: string;
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
  subMenu?: SubMenuItem[];
  className?: string;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, x, y, items, onClose }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu-container')) {
      onClose();
      setActiveSubMenu(null);
    }
  }, [onClose]);

  const adjustSubMenuPosition = useCallback((subMenuId: string) => {
    if (!menuRef.current) return;
    
    const subMenu = subMenuRefs.current.get(subMenuId);
    if (!subMenu) return;

    requestAnimationFrame(() => {
      try {
        const menuRect = menuRef.current?.getBoundingClientRect();
        const subMenuRect = subMenu.getBoundingClientRect();
        
        if (!menuRect) return;

        const maxWidth = document.documentElement.clientWidth || window.innerWidth;
        const maxHeight = document.documentElement.clientHeight || window.innerHeight;
        const padding = 8;
        const subMenuRight = menuRect.right + subMenuRect.width;
        const subMenuBottom = menuRect.top + subMenuRect.height;

        if (subMenuRight > maxWidth - padding) {
          subMenu.style.setProperty('left', 'auto');
          subMenu.style.setProperty('right', '100%');
          subMenu.style.setProperty('margin-left', '0');
          subMenu.style.setProperty('margin-right', '1px');
        } else {
          subMenu.style.setProperty('left', '100%');
          subMenu.style.setProperty('right', 'auto');
          subMenu.style.setProperty('margin-left', '1px');
          subMenu.style.setProperty('margin-right', '0');
        }

        if (subMenuBottom > maxHeight - padding) {
          subMenu.style.setProperty('top', 'auto');
          subMenu.style.setProperty('bottom', '0');
        } else {
          subMenu.style.setProperty('top', '0');
          subMenu.style.setProperty('bottom', 'auto');
        }
      } catch (error) {
        console.warn('Failed to adjust submenu position:', error);
      }
    });
  }, []);

  useEffect(() => {
    if (activeSubMenu) {
      adjustSubMenuPosition(activeSubMenu);
    }
  }, [activeSubMenu, adjustSubMenuPosition]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (activeSubMenu) {
          adjustSubMenuPosition(activeSubMenu);
        }
      });
      
      resizeObserverRef.current.observe(document.body);
      
      return () => {
        resizeObserverRef.current?.disconnect();
      };
    }
  }, [isOpen, activeSubMenu, adjustSubMenuPosition]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      
      const padding = 8;
      const maxWidth = document.documentElement.clientWidth || window.innerWidth;
      const maxHeight = document.documentElement.clientHeight || window.innerHeight;
      
      const itemHeight = 24;
      const menuWindowPadding = 8;
      const dividerHeight = 4;
      
      const dividerCount = items.filter(item => item.divider).length;
      const estimatedHeight = items.length * itemHeight + dividerCount * dividerHeight + menuWindowPadding;
      const estimatedWidth = 160;
      
      let newX = x;
      let newY = y;
      
      if (newX + estimatedWidth > maxWidth - padding) {
        newX = maxWidth - estimatedWidth - padding;
      }
      if (newX < padding) {
        newX = padding;
      }
      
      if (newY + estimatedHeight > maxHeight - padding) {
        newY = maxHeight - estimatedHeight - padding;
      }
      if (newY < padding) {
        newY = padding;
      }
      
      menu.style.left = `${newX}px`;
      menu.style.top = `${newY}px`;
    }
  }, [isOpen, x, y, items]);

  useEffect(() => {
    const refs = subMenuRefs.current;
    return () => {
      refs.clear();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="context-menu-container" 
      style={{ 
        left: x + 8, 
        top: y + 8 
      }}
    >
      <div className="popup-menu-window">
        <ul className="popup-menu-list">
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.divider ? (
                <li className="popup-menu-divider"></li>
              ) : (
                <li className={`relative ${item.subMenu ? 'has-submenu' : ''}`}>
                  <button 
                    className={`popup-menu-item w-full ${item.className || ''}`} 
                    onClick={() => {
                      if (item.subMenu) {
                        setActiveSubMenu(activeSubMenu === item.id ? null : item.id);
                      } else {
                        item.onClick?.();
                        onClose();
                      }
                    }}
                    onMouseEnter={() => {
                      if (item.subMenu) {
                        setActiveSubMenu(item.id);
                      } else {
                        setActiveSubMenu(null);
                      }
                    }}
                  >
                    <span className="popup-menu-icon">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.subMenu && <span>▶</span>}
                  </button>
                  {item.subMenu && activeSubMenu === item.id && (
                    <div 
                      ref={(el) => {
                        if (el) {
                          subMenuRefs.current.set(item.id, el as HTMLDivElement);
                        }
                      }}
                      className="popup-menu-window context-submenu"
                      onMouseLeave={() => {
                        setActiveSubMenu(null);
                      }}
                    >
                      <ul className="popup-menu-list">
                        {item.subMenu.map((subItem) => (
                          <li key={subItem.id}>
                            <button 
                              className="popup-menu-item w-full" 
                              onClick={() => {
                                subItem.onClick();
                                onClose();
                                setActiveSubMenu(null);
                              }}
                            >
                              <span className="popup-menu-icon">
                                {subItem.icon}
                              </span>
                              <span>{subItem.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ContextMenu;