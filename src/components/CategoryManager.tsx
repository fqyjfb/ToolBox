import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

export interface CategoryItem {
  id: string;
  name: string;
  parent_id: string | null;
  children?: CategoryItem[];
}

interface CategoryManagerProps {
  categories: CategoryItem[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onAddCategory: (name: string, parentId: string | null) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onUpdateCategory: (categoryId: string, name: string) => Promise<void>;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategory,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingSubcategoryParentId, setAddingSubcategoryParentId] = useState<string | null>(null);
  const [subcategoryInputValue, setSubcategoryInputValue] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleAddMainCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      await onAddCategory(newCategoryName.trim(), null);
      setNewCategoryName('');
    } catch (error) {
      console.error('添加分类失败:', error);
    }
  };

  const handleAddSubcategory = async (parentId: string) => {
    if (!subcategoryInputValue.trim()) return;
    
    try {
      await onAddCategory(subcategoryInputValue.trim(), parentId);
      setAddingSubcategoryParentId(null);
      setSubcategoryInputValue('');
    } catch (error) {
      console.error('添加子分类失败:', error);
    }
  };

  const handleStartEdit = (category: CategoryItem) => {
    setEditingCategory(category.id);
    setEditingName(category.name);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingName.trim()) return;
    
    try {
      await onUpdateCategory(editingCategory, editingName.trim());
      setEditingCategory(null);
      setEditingName('');
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingName('');
  };

  const handleDelete = (category: CategoryItem) => {
    setCategoryToDelete(category);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    
    try {
      await onDeleteCategory(categoryToDelete.id);
    } catch (error) {
      console.error('删除分类失败:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  const renderCategory = (category: CategoryItem, level: number = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const isEditing = editingCategory === category.id;

    return (
      <div key={category.id} className="relative">
        <div
          className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
            selectedCategory === category.id
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            toggleExpand(category.id);
            onSelectCategory(category.id);
          }}
        >
          <span className="text-gray-400">
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </span>
          
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
            />
          ) : (
            <span className="text-sm font-medium truncate flex-1">{category.name}</span>
          )}
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditing ? (
              <>
                <button
                  className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(category);
                  }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(category);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-1">
            {category.children!.map((child) => renderCategory(child, level + 1))}
            
            {addingSubcategoryParentId === category.id && (
              <div className="flex items-center gap-2 mt-1 px-3" style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}>
                <input
                  type="text"
                  placeholder="输入子分类名称"
                  value={subcategoryInputValue}
                  onChange={(e) => setSubcategoryInputValue(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (subcategoryInputValue.trim()) {
                        handleAddSubcategory(category.id);
                      }
                    }
                    if (e.key === 'Escape') {
                      setAddingSubcategoryParentId(null);
                      setSubcategoryInputValue('');
                    }
                  }}
                />
              </div>
            )}

            {addingSubcategoryParentId !== category.id && (
              <button
                className="flex items-center gap-1 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingSubcategoryParentId(category.id);
                }}
              >
                <Plus size={12} />
                添加子分类
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
        <span className="text-gray-500 dark:text-gray-400 text-sm">+ 添加主分类</span>
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="输入分类名称"
          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddMainCategory();
            }
          }}
        />
        <button
          disabled={!newCategoryName.trim()}
          className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:text-gray-400 disabled:cursor-not-allowed"
          title="保存"
          onClick={handleAddMainCategory}
        >
          <Edit2 size={16} />
        </button>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {categories.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            暂无分类
          </div>
        ) : (
          <div className="py-2">
            {categories.map((category) => renderCategory(category))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setCategoryToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="确认删除"
        message="确定要删除这个分类吗？"
        deleteItemName={categoryToDelete ? `分类：${categoryToDelete.name}` : undefined}
        confirmText="确定"
        cancelText="取消"
      />
    </div>
  );
};

export default CategoryManager;