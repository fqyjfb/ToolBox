import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Zap, FileText, Clock, User, Settings, Info, X, Grid3X3, LayoutDashboard } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuthStore } from '../../store/AuthStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { ALL_TOOLS, ToolInfo } from '../../constants/tools';
import { isElectron } from '../../utils/environment';
import { iconMap } from '../../utils/iconMap';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = isElectron();

  const { isCollapsed, isVisible, pinnedToolIds, removePinnedTool, reorderPinnedTools } = useSidebarStore();
  const { isAuthenticated, isAdmin } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;
  const isStartsWith = (prefix: string) => location.pathname.startsWith(prefix);

  const pinnedTools = useMemo(
    () => pinnedToolIds.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolInfo[],
    [pinnedToolIds]
  );

  const fixedItems = [
    { id: 'home', title: '首页', icon: <Home className="w-4 h-4 flex-shrink-0" />, path: '/', active: isActive('/') },
    ...(isDesktop ? [{ id: 'launch', title: '快启动', icon: <Zap className="w-4 h-4 flex-shrink-0" />, path: '/launch', active: isActive('/launch') }] : []),
    { id: 'notes', title: '记事本', icon: <FileText className="w-4 h-4 flex-shrink-0" />, path: '/tools/notes', active: isStartsWith('/tools/notes') },
    { id: 'tools', title: '工具中心', icon: <Grid3X3 className="w-4 h-4 flex-shrink-0" />, path: '/tools', active: isActive('/tools') },
    { id: 'recents', title: '最近使用', icon: <Clock className="w-4 h-4 flex-shrink-0" />, path: '/recents', active: isActive('/recents') },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeIndex = pinnedToolIds.indexOf(active.id as string);
      const overIndex = pinnedToolIds.indexOf(over.id as string);
      if (activeIndex !== -1 && overIndex !== -1) {
        reorderPinnedTools(arrayMove(pinnedToolIds, activeIndex, overIndex));
      }
    }
  };

  if (!isVisible) return null;

  return (
    <aside className={`sidebar-root ${isCollapsed ? 'collapsed' : 'expanded'}`} style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="sidebar-logo" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={() => navigate('/')}>
        <img src="./favicon.png" alt="ToolBox" className="w-8 h-8 flex-shrink-0" />
        {!isCollapsed && <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">ToolBox</span>}
      </div>

      <nav className="sidebar-fixed" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {fixedItems.map((item) => (
          <NavItem key={item.id} icon={item.icon} title={item.title} active={item.active} collapsed={isCollapsed} onClick={() => navigate(item.path)} />
        ))}
      </nav>

      {!isCollapsed && <div className="sidebar-divider" />}

      <nav className="sidebar-pinned" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {pinnedTools.length === 0 && !isCollapsed && (
          <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">右键工具卡片添加到此处</div>
        )}
        {!isCollapsed && pinnedTools.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pinnedToolIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {pinnedTools.map((tool) => {
                  const Icon = iconMap[tool.iconName];
                  return (
                    <SortableNavItem
                      key={tool.id}
                      id={tool.id}
                      icon={Icon ? <Icon className="w-4 h-4 flex-shrink-0" style={{ color: tool.color }} /> : null}
                      title={tool.name}
                      active={isActive(tool.path)}
                      onClick={() => navigate(tool.path)}
                      onRemove={() => removePinnedTool(tool.id)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          pinnedTools.map((tool) => {
            const Icon = iconMap[tool.iconName];
            return (
              <NavItem
                key={tool.id}
                icon={Icon ? <Icon className="w-4 h-4 flex-shrink-0" style={{ color: tool.color }} /> : null}
                title={tool.name}
                active={isActive(tool.path)}
                collapsed={isCollapsed}
                onClick={() => navigate(tool.path)}
                onRemove={() => removePinnedTool(tool.id)}
              />
            );
          })
        )}
      </nav>

      <div className="sidebar-bottom" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {!isCollapsed && <div className="sidebar-divider" />}
        <div className={`flex items-center gap-1 px-1 ${isCollapsed ? 'flex-col' : ''}`}>
          <SidebarBottomButton icon={<User className="w-4 h-4" />} title={isAuthenticated ? '个人信息' : '登录'} onClick={() => navigate(isAuthenticated ? '/tools/profile' : '/login')} />
          {isAdmin && (
            <SidebarBottomButton icon={<LayoutDashboard className="w-4 h-4" />} title="管理" onClick={() => navigate('/admin')} />
          )}
          <SidebarBottomButton icon={<Settings className="w-4 h-4" />} title="设置" onClick={() => navigate('/settings')} />
          <SidebarBottomButton icon={<Info className="w-4 h-4" />} title="关于" onClick={() => navigate('/about')} />
        </div>
      </div>
    </aside>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  title: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, title, active, collapsed, onClick, onRemove }) => (
  <div className="relative group">
    <button
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? title : ''}
      onClick={onClick}
    >
      {icon}
      {!collapsed && <span className="whitespace-nowrap">{title}</span>}
    </button>
    {!collapsed && onRemove && (
      <button className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="移除">
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
);

interface SortableNavItemProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

const SortableNavItem: React.FC<SortableNavItemProps> = ({ id, icon, title, active, onClick, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.5 : 1, scale: isDragging ? 1.05 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group cursor-grab active:cursor-grabbing">
      <button
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          active ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
        }`}
        onClick={onClick}
      >
        {icon}
        <span className="whitespace-nowrap flex-1">{title}</span>
      </button>
      {onRemove && (
        <button className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="移除">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

interface SidebarBottomButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

const SidebarBottomButton: React.FC<SidebarBottomButtonProps> = ({ icon, title, onClick }) => (
  <button className="flex items-center justify-center w-8 h-8 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors" title={title} onClick={onClick}>
    {icon}
  </button>
);

export default Sidebar;