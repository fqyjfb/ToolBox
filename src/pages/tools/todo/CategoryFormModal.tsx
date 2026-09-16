import React from 'react'
import Modal from '../../../components/ui/Modal'
import { Edit, Trash2 } from 'lucide-react'
import { TodoCategory } from '../../../services/TodoService'
import { modalControlClass } from '../account/shared'

const COLOR_OPTIONS = [
  '#3B82F6',
  '#F97316',
  '#A855F7',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
]

interface CategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingCategory: TodoCategory | null
  newCategoryName: string
  newCategoryColor: string
  categories: TodoCategory[]
  onNewCategoryNameChange: (name: string) => void
  onNewCategoryColorChange: (color: string) => void
  onConfirm: () => void
  onEditCategory: (category: TodoCategory) => void
  onDeleteCategory: (id: string) => void
  onOpenConfirmDialog: (title: string, message: string, onConfirm: () => void) => void
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onClose,
  editingCategory,
  newCategoryName,
  newCategoryColor,
  categories,
  onNewCategoryNameChange,
  onNewCategoryColorChange,
  onConfirm,
  onEditCategory,
  onDeleteCategory,
  onOpenConfirmDialog
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCategory ? '编辑分类' : '新建分类'}
      confirmText={editingCategory ? '保存' : '创建'}
      onConfirm={onConfirm}
      confirmDisabled={!newCategoryName.trim()}
    >
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">分类名称 *</label>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => onNewCategoryNameChange(e.target.value)}
            placeholder="输入分类名称"
            className={modalControlClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">颜色</label>
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_OPTIONS.map((color) => (
              <div
                key={color}
                className={`w-6 h-6 rounded-full cursor-pointer border transition-all ${
                  newCategoryColor === color
                    ? 'border-gray-800 scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => onNewCategoryColorChange(color)}
              />
            ))}
          </div>
        </div>
        {categories.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">现有分类</h3>
            <div className="space-y-1.5">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <span className="text-sm text-gray-800 dark:text-white">{category.name}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onEditCategory(category)}
                      className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => onDeleteCategory(category.id))}
                      className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default CategoryFormModal