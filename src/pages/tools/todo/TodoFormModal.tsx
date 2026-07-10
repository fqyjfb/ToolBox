import React from 'react'
import Modal from '../../../components/ui/Modal'
import { Todo, TodoCategory } from '../../../services/TodoService'
import { CreateTodoRequest } from '../../../services/TodoService'

interface TodoFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingTodo: Todo | null
  newTodo: CreateTodoRequest & { category_id: string | null }
  categories: TodoCategory[]
  onNewTodoChange: (newTodo: CreateTodoRequest & { category_id: string | null }) => void
  onConfirm: () => void
  formatDateTimeForInput: (dateTimeStr: string) => string
}

const TodoFormModal: React.FC<TodoFormModalProps> = ({
  isOpen,
  onClose,
  editingTodo,
  newTodo,
  categories,
  onNewTodoChange,
  onConfirm,
  formatDateTimeForInput
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTodo ? '编辑任务' : '添加新任务'}
      confirmText={editingTodo ? '保存' : '添加'}
      onConfirm={onConfirm}
      confirmDisabled={!newTodo.title.trim()}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">任务标题 *</label>
          <input
            type="text"
            value={newTodo.title}
            onChange={(e) => onNewTodoChange({ ...newTodo, title: e.target.value })}
            placeholder="输入任务标题"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
            <select
              value={newTodo.category_id || ''}
              onChange={(e) => onNewTodoChange({ ...newTodo, category_id: e.target.value || null })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            >
              <option value="">未分类</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
            <select
              value={newTodo.priority}
              onChange={(e) => onNewTodoChange({ ...newTodo, priority: e.target.value as '高' | '中' | '低' })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            >
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">截止日期</label>
            <input
              type="datetime-local"
              value={newTodo.due_date ? formatDateTimeForInput(newTodo.due_date) : ''}
              onChange={(e) => onNewTodoChange({ ...newTodo, due_date: e.target.value.replace('T', ' ') })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
          <textarea
            value={newTodo.description}
            onChange={(e) => onNewTodoChange({ ...newTodo, description: e.target.value })}
            placeholder="输入任务描述"
            rows={2}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    </Modal>
  )
}

export default TodoFormModal