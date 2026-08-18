import React from 'react'
import Modal from '../../../components/ui/Modal'
import Select from '../../../components/ui/Select'
import { Todo, TodoCategory, CreateTodoRequest } from '../../../services/TodoService'
import { modalControlClass, modalTextareaClass } from '../account/shared'

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
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">任务标题 *</label>
          <input
            type="text"
            value={newTodo.title}
            onChange={(e) => onNewTodoChange({ ...newTodo, title: e.target.value })}
            placeholder="输入任务标题"
            className={modalControlClass}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
            <Select
              value={newTodo.category_id || ''}
              onChange={(v) => onNewTodoChange({ ...newTodo, category_id: v || null })}
              options={[
                { value: '', label: '未分类' },
                ...categories.map(category => ({ value: category.id, label: category.name }))
              ]}
              className={modalControlClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
            <Select
              value={newTodo.priority || ''}
              onChange={(v) => onNewTodoChange({ ...newTodo, priority: v as '高' | '中' | '低' })}
              options={[
                { value: '高', label: '高' },
                { value: '中', label: '中' },
                { value: '低', label: '低' }
              ]}
              className={modalControlClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">截止日期</label>
            <input
              type="datetime-local"
              value={newTodo.due_date ? formatDateTimeForInput(newTodo.due_date) : ''}
              onChange={(e) => onNewTodoChange({ ...newTodo, due_date: e.target.value.replace('T', ' ') })}
              className={modalControlClass}
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
            className={modalTextareaClass}
          />
        </div>
      </div>
    </Modal>
  )
}

export default TodoFormModal