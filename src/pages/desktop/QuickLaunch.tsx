import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Rocket, FolderPlus, Edit2, Trash2, Plus, Tag, Folder, Home } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuickLaunchCategory, QuickLaunchItem, addHomeQuickLaunchApp, isAppInHomeQuickLaunch } from '../../utils/quickLaunch';
import { useNavSearch } from '../../contexts/NavSearchContext';
import Modal from '../../components/ui/Modal';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import './QuickLaunch.css';

const SortableAppItem: React.FC<{ app: QuickLaunchItem; iconSize: 'small' | 'medium'; onLaunch: (path: string) => void; onContextMenu: (e: React.MouseEvent) => void; }> = ({ app, iconSize, onLaunch, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.1 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-200 ${
        iconSize === 'small' ? 'w-[80px] h-[68px]' : 'w-[100px] h-[84px]'
      } ${isDragging ? 'shadow-lg' : 'hover:-translate-y-1 hover:scale-105'}`}
      onClick={() => onLaunch(app.path)}
      onContextMenu={onContextMenu}
    >
      {app.icon ? (
        <img 
          src={`data:image/png;base64,${app.icon}`} 
          alt={app.name}
          className={`object-contain mb-1 ${
            iconSize === 'small' ? 'w-8 h-8' : 'w-12 h-12'
          }`}
        />
      ) : (
        <Rocket className={`text-gray-500 dark:text-gray-400 mb-1 ${
          iconSize === 'small' ? 'w-8 h-8' : 'w-12 h-12'
        }`} />
      )}
      <span className={`font-medium text-gray-700 dark:text-gray-200 truncate w-full text-center ${
        iconSize === 'small' ? 'text-[8px]' : 'text-[10px]'
      }`}>
        {app.name}
      </span>
    </div>
  );
};

const SortableCategoryItem: React.FC<{ category: QuickLaunchCategory; isActive: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void; }> = ({ category, isActive, onClick, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.1 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing`}
    >
      <button
        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${
          isActive 
            ? 'text-white' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        style={isActive ? { backgroundColor: category.color } : {}}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <Tag size={12} />
        {category.name}
      </button>
    </div>
  );
};

const QuickLaunch: React.FC = () => {
  const { searchQuery, isSearchActive } = useNavSearch();
  const [apps, setApps] = useState<QuickLaunchItem[]>([]);
  const [categories, setCategories] = useState<QuickLaunchCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [editingApp, setEditingApp] = useState<QuickLaunchItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<QuickLaunchCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'app' | 'category' | 'empty';
    targetId?: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'empty'
  });
  const [iconSize, setIconSize] = useState<'small' | 'medium'>(() => {
    const saved = localStorage.getItem('quickLaunchIconSize');
    return (saved === 'small' || saved === 'medium') ? saved : 'medium';
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const savedApps = localStorage.getItem('quickLaunchApps');
    if (savedApps) {
      try {
        setApps(JSON.parse(savedApps));
      } catch {
        setApps([]);
      }
    }

    const savedCategories = localStorage.getItem('quickLaunchCategories');
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch {
        setCategories([]);
      }
    } else {
      const defaultCategories: QuickLaunchCategory[] = [
        { id: '1', name: '常用', color: 'var(--color-category-1)' },
        { id: '2', name: '开发', color: 'var(--color-category-2)' },
        { id: '3', name: '设计', color: 'var(--color-category-3)' },
      ];
      setCategories(defaultCategories);
      localStorage.setItem('quickLaunchCategories', JSON.stringify(defaultCategories));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quickLaunchIconSize', iconSize);
  }, [iconSize]);

  useEffect(() => {
    localStorage.setItem('quickLaunchApps', JSON.stringify(apps));
  }, [apps]);

  useEffect(() => {
    localStorage.setItem('quickLaunchCategories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, isOpen: false }));
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const getAppName = useCallback((path: string): string => {
    const name = path.split(/[\\/]/).pop() || path;
    return name.replace(/\.(exe|bat|cmd|lnk)$/i, '');
  }, []);

  const handleLaunch = useCallback((path: string) => {
    window.electron?.openFile(path);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setApps(prev => prev.filter(app => app.id !== id));
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleAddCustom = useCallback(async () => {
    if (customPath.trim()) {
      const lowerPath = customPath.toLowerCase();
      const exists = apps.some(app => app.path.toLowerCase() === lowerPath);
      
      if (exists) {
        console.log('Duplicate app detected, skipping:', customPath);
        return;
      }
      
      const icon = await window.electron?.getFileIcon(customPath) || undefined;
      const newApp: QuickLaunchItem = {
        id: Date.now().toString(),
        name: getAppName(customPath),
        path: customPath,
        icon,
        categoryId: activeCategoryId === 'all' ? (categories[0]?.id || '') : activeCategoryId,
        addedAt: Date.now(),
      };
      setApps(prev => [...prev, newApp]);
      setCustomPath('');
      setShowAddDialog(false);
    }
  }, [customPath, getAppName, activeCategoryId, categories, apps]);

  const handleSelectFile = useCallback(async () => {
    const result = await window.electron?.selectFile();
    if (result) {
      setCustomPath(result);
    }
  }, []);

  const handleDropFiles = useCallback(async (paths: string[]) => {
    const targetCategoryId = activeCategoryId === 'all' ? (categories[0]?.id || '') : activeCategoryId;
    
    for (const path of paths) {
      const lowerPath = path.toLowerCase();
      const exists = apps.some(app => app.path.toLowerCase() === lowerPath);
      
      if (exists) {
        continue;
      }
      
      const icon = await window.electron?.getFileIcon(path) || undefined;
      const newApp: QuickLaunchItem = {
        id: Date.now().toString(),
        name: getAppName(path),
        path,
        icon,
        categoryId: targetCategoryId,
        addedAt: Date.now(),
      };
      setApps(prev => [...prev, newApp]);
    }
  }, [apps, activeCategoryId, categories, getAppName]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const fileDataList: { name: string; type: string; size: number; path?: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File & { path?: string };
        fileDataList.push({
          name: file.name,
          type: file.type,
          size: file.size,
          path: file.path
        });
      }
      
      const validPaths = await window.electron?.getDroppedFiles(fileDataList);
      if (validPaths && validPaths.length > 0) {
        handleDropFiles(validPaths);
      }
    }
  }, [handleDropFiles]);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'app' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, type, targetId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleAddApp = useCallback(() => {
    setShowAddDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleClearAll = useCallback(() => {
    setApps([]);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleRename = useCallback((app: QuickLaunchItem) => {
    setEditingApp(app);
    setShowEditDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleMoveToCategory = useCallback((appId: string, categoryId: string) => {
    setApps(prev => prev.map(app => 
      app.id === appId ? { ...app, categoryId } : app
    ));
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSaveRename = useCallback(() => {
    if (editingApp) {
      setApps(prev => prev.map(app => 
        app.id === editingApp.id ? { ...app, name: editingApp.name } : app
      ));
      setEditingApp(null);
      setShowEditDialog(false);
    }
  }, [editingApp]);

  const handleAddCategory = useCallback(() => {
    setEditingCategory(null);
    setNewCategoryName('');
    setShowCategoryDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleEditCategory = useCallback((category: QuickLaunchCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setShowCategoryDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSaveCategory = useCallback(() => {
    if (newCategoryName.trim()) {
      if (editingCategory) {
        setCategories(prev => prev.map(cat => 
          cat.id === editingCategory.id ? { ...cat, name: newCategoryName } : cat
        ));
      } else {
        const colors = ['var(--color-category-1)', 'var(--color-category-2)', 'var(--color-category-3)', 'var(--color-accent)', 'var(--color-category-4)', 'var(--color-success)', 'var(--color-error)'];
        const newCategory: QuickLaunchCategory = {
          id: Date.now().toString(),
          name: newCategoryName,
          color: colors[categories.length % colors.length],
        };
        setCategories(prev => [...prev, newCategory]);
      }
      setShowCategoryDialog(false);
      setNewCategoryName('');
      setEditingCategory(null);
    }
  }, [newCategoryName, editingCategory, categories.length]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    setApps(prev => prev.map(app => 
      app.categoryId === categoryId ? { ...app, categoryId: categories[0]?.id || '' } : app
    ));
    if (activeCategoryId === categoryId) {
      setActiveCategoryId('all');
    }
    handleCloseContextMenu();
  }, [activeCategoryId, categories, handleCloseContextMenu]);

  const filteredApps = useMemo(() => {
    let result = apps;
    
    if (activeCategoryId !== 'all') {
      result = result.filter(app => app.categoryId === activeCategoryId);
    }
    
    if (isSearchActive && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(app => 
        app.name.toLowerCase().includes(query) ||
        app.path.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [apps, activeCategoryId, isSearchActive, searchQuery]);

  const handleAppsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeIndex = filteredApps.findIndex(app => app.id === active.id);
      const overIndex = filteredApps.findIndex(app => app.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reorderedIds = arrayMove(filteredApps.map(app => app.id), activeIndex, overIndex);
        
        setApps(prev => {
          const sortedApps = [...prev].sort((a, b) => {
            const indexA = reorderedIds.indexOf(a.id);
            const indexB = reorderedIds.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          return sortedApps;
        });
      }
    }
  }, [filteredApps]);

  const handleCategoriesDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories(prev => {
        const oldIndex = prev.findIndex(cat => cat.id === active.id);
        const newIndex = prev.findIndex(cat => cat.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'app' && contextMenu.targetId) {
      const app = apps.find(a => a.id === contextMenu.targetId);
      if (!app) return [];
      
      return [
        {
          id: 'open',
          label: '打开',
          icon: <Rocket className="w-4 h-4" />,
          onClick: () => handleLaunch(app.path)
        },
        {
          id: 'rename',
          label: '重命名',
          icon: <Edit2 className="w-4 h-4" />,
          onClick: () => handleRename(app)
        },
        {
          id: 'add-to-home',
          label: app && isAppInHomeQuickLaunch(app.path) ? '已添加到首页' : '加到首页',
          icon: <Home className="w-4 h-4" />,
          onClick: () => {
            if (app) {
              addHomeQuickLaunchApp(app);
            }
            handleCloseContextMenu();
          }
        },
        {
          id: 'move-to-category',
          label: '移动到分组',
          icon: <Folder className="w-4 h-4" />,
          subMenu: categories.map((category) => ({
            id: `category-${category.id}`,
            label: category.name,
            icon: <Tag className="w-4 h-4" />,
            onClick: () => handleMoveToCategory(app.id, category.id)
          }))
        },
        { id: 'divider1', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleRemove(app.id)
        }
      ];
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = categories.find(c => c.id === contextMenu.targetId);
      if (!category) return [];
      
      return [
        {
          id: 'edit',
          label: '编辑名称',
          icon: <Edit2 className="w-4 h-4" />,
          onClick: () => handleEditCategory(category)
        },
        { id: 'divider1', divider: true },
        {
          id: 'delete',
          label: '删除分类',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleDeleteCategory(category.id)
        }
      ];
    }

    if (contextMenu.type === 'empty') {
      const items: ContextMenuItem[] = [
        {
          id: 'add-app',
          label: '添加应用',
          icon: <FolderPlus className="w-4 h-4" />,
          onClick: handleAddApp
        },
        {
          id: 'add-category',
          label: '添加分类',
          icon: <Plus className="w-4 h-4" />,
          onClick: handleAddCategory
        }
      ];
      
      if (apps.length > 0) {
        items.push({ id: 'divider1', divider: true });
        items.push({
          id: 'clear-all',
          label: '清空全部',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: handleClearAll
        });
      }
      
      return items;
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, apps, categories, handleLaunch, handleRename, handleMoveToCategory, handleRemove, handleEditCategory, handleDeleteCategory, handleAddApp, handleAddCategory, handleClearAll, handleCloseContextMenu]);

  return (
    <div
        className="h-full flex flex-col"
        onContextMenu={(e) => handleContextMenu(e, 'empty')}
      >
        
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              activeCategoryId === 'all' 
                ? 'bg-[#009ebe] text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setActiveCategoryId('all')}
          >
            全部
          </button>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoriesDragEnd}
          >
            <SortableContext items={categories.map(cat => cat.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    isActive={activeCategoryId === category.id}
                    onClick={() => setActiveCategoryId(category.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={handleAddCategory}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="添加分类"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <label className="icon-toggle-container" title={iconSize === 'small' ? '当前：小图标' : '当前：中图标'}>
            <input 
              type="checkbox" 
              checked={iconSize === 'medium'} 
              onChange={(e) => setIconSize(e.target.checked ? 'medium' : 'small')}
            />
            <svg viewBox="0 0 448 512" height="1.25em" className="expand-icon">
              <path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z" />
            </svg>
            <svg viewBox="0 0 448 512" height="1.25em" className="compress-icon">
              <path d="M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z" />
            </svg>
          </label>
        </div>
      </div>

      <div 
        className={`flex-1 p-6 overflow-auto transition-colors duration-200 ${
          isDragOver ? 'bg-green-50 dark:bg-green-900/20' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {filteredApps.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAppsDragEnd}
          >
            <SortableContext items={filteredApps.map(app => app.id)} strategy={verticalListSortingStrategy}>
              <div className={`grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-[15px] min-h-[300px] transition-all duration-200 ${
                isDragOver ? 'border-2 border-dashed border-green-400 rounded-lg p-4' : ''
              }`}>
                {filteredApps.map((app) => (
                  <SortableAppItem
                    key={app.id}
                    app={app}
                    iconSize={iconSize}
                    onLaunch={handleLaunch}
                    onContextMenu={(e) => handleContextMenu(e, 'app', app.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className={`flex flex-col items-center justify-center h-full text-gray-400 transition-all duration-200 ${
            isDragOver ? 'border-2 border-dashed border-green-400 rounded-lg p-8' : ''
          }`}>
            <Rocket size={64} className={`mb-4 transition-opacity duration-200 ${isDragOver ? 'opacity-100 text-green-500' : 'opacity-50'}`} />
            <p className="text-lg">{isDragOver ? '松开鼠标添加应用' : '暂无快启动应用'}</p>
            <p className="text-sm">{isDragOver ? '支持拖拽多个应用' : '右键点击空白处添加应用'}</p>
          </div>
        )}
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={handleCloseContextMenu}
      />

      <Modal
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title="添加快启动应用"
        confirmText="添加"
        onConfirm={handleAddCustom}
        confirmDisabled={!customPath.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              应用路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="输入应用程序路径..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleSelectFile}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              分类
            </label>
            <select
              value={activeCategoryId === 'all' ? (categories[0]?.id || '') : activeCategoryId}
              onChange={() => {}}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        title="重命名应用"
        confirmText="保存"
        onConfirm={handleSaveRename}
        confirmDisabled={!editingApp?.name.trim()}
      >
        {editingApp && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                应用名称
              </label>
              <input
                type="text"
                value={editingApp.name}
                onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCategoryDialog}
        onClose={() => setShowCategoryDialog(false)}
        title={editingCategory ? '编辑分类' : '添加分类'}
        confirmText={editingCategory ? '保存' : '添加'}
        onConfirm={handleSaveCategory}
        confirmDisabled={!newCategoryName.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              分类名称
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="输入分类名称..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuickLaunch;