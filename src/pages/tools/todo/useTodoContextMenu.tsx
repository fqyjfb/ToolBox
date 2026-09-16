import { useCallback, useState } from 'react'
import { Edit, Trash2, CheckSquare, Plus, Tag } from 'lucide-react'
import { Todo, TodoCategory } from '../../../services/TodoService'
import { ContextMenuItem } from '../../../components/ui/ContextMenu'

export const useTodoContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    x: number
    y: number
    type: 'item' | 'category' | 'empty'
    targetId?: string
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'empty'
  })

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'item' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId
    })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }, [])

  const getContextMenuItems = useCallback((
    todos: Todo[],
    categories: TodoCategory[],
    onEditTodo: (todo: Todo) => void,
    onToggleComplete: (id: string) => void,
    onDeleteTodo: (id: string) => void,
    onEditCategory: (category: TodoCategory) => void,
    onDeleteCategory: (id: string) => void,
    onOpenConfirmDialog: (title: string, message: string, onConfirm: () => void) => void,
    onCloseContextMenu: () => void,
    onShowAddTodoModal: () => void,
    onShowCategoryModal: () => void
  ): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const item = todos.find(i => i.id === contextMenu.targetId)
      if (!item) return []

      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => onEditTodo(item)
        },
        {
          id: 'toggle',
          label: item.is_completed ? '标记为未完成' : '标记为完成',
          icon: <CheckSquare className={`w-4 h-4 ${item.is_completed ? 'fill-current' : ''}`} />,
          onClick: () => {
            onToggleComplete(item.id)
            onCloseContextMenu()
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => onOpenConfirmDialog('删除确认', '确定要删除这个任务吗？', () => onDeleteTodo(item.id))
        }
      ]
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = categories.find(c => c.id === contextMenu.targetId)
      if (!category) return []

      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            onEditCategory(category)
            onCloseContextMenu()
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => onOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => onDeleteCategory(category.id))
        }
      ]
    }

    if (contextMenu.type === 'empty') {
      return [
        {
          id: 'add-todo',
          label: '添加任务',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            onShowAddTodoModal()
            onCloseContextMenu()
          }
        },
        {
          id: 'add-category',
          label: '添加分类',
          icon: <Tag className="w-4 h-4" />,
          onClick: () => {
            onShowCategoryModal()
            onCloseContextMenu()
          }
        }
      ]
    }

    return []
  }, [contextMenu.type, contextMenu.targetId])

  return { contextMenu, handleContextMenu, handleCloseContextMenu, getContextMenuItems }
}