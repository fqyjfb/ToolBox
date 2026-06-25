import React from 'react'
import Modal from '../../../components/ui/Modal'
import { Edit, Trash2 } from 'lucide-react'
import { TodoCategory } from '../../../services/TodoService'

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
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类名称 *</label>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => onNewCategoryNameChange(e.target.value)}
            placeholder="输入分类名称"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">颜色</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((color) => (
              <div
                key={color}
                className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-all bg-[${color}] ${
                  newCategoryColor === color
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                onClick={() => onNewCategoryColorChange(color)}
              />
            ))}
          </div>
        </div>
        {categories.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">现有分类</h3>
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <span className="text-sm text-gray-800 dark:text-white">{category.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEditCategory(category)}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => onDeleteCategory(category.id))}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
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