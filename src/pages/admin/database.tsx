import React, { useState, useRef } from 'react'
import { Download, Upload, Database, AlertTriangle } from 'lucide-react'
import { databaseBackupService } from '../../services/DatabaseBackupService'
import Modal from '../../components/ui/Modal'
import { useToastStore } from '../../store/toastStore'

interface SettingsState {
  isLoading: boolean
  showRestoreDialog: boolean
  restoreData: string | null
}

const DatabasePage: React.FC = () => {
  const { addToast } = useToastStore()
  const [state, setState] = useState<SettingsState>({
    isLoading: false,
    showRestoreDialog: false,
    restoreData: null
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportSQL = async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const sql = await databaseBackupService.exportToSQL()
      databaseBackupService.downloadSQL(sql)
      addToast({ type: 'success', message: 'SQL备份文件已生成并下载' })
    } catch {
      addToast({ type: 'error', message: '备份失败，请重试' })
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleExportJSON = async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const data = await databaseBackupService.exportData()
      databaseBackupService.downloadJSON(data)
      addToast({ type: 'success', message: 'JSON备份文件已生成并下载' })
    } catch {
      addToast({ type: 'error', message: '备份失败，请重试' })
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setState(prev => ({
        ...prev,
        restoreData: content,
        showRestoreDialog: true
      }))
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const handleRestore = async () => {
    if (!state.restoreData) return

    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const result = await databaseBackupService.importFromJSON(state.restoreData)
      if (result.success) {
        addToast({ type: 'success', message: result.message })
        setState(prev => ({
          ...prev,
          showRestoreDialog: false,
          restoreData: null
        }))
      } else {
        addToast({ type: 'error', message: result.message })
      }
    } catch {
      addToast({ type: 'error', message: '恢复失败，请检查备份文件格式' })
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleCancelRestore = () => {
    setState(prev => ({
      ...prev,
      showRestoreDialog: false,
      restoreData: null
    }))
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full">
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">数据管理</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">数据库备份与恢复</p>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              备份整个数据库的数据，支持导出为SQL或JSON格式。恢复功能将从备份文件中恢复所有数据。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">数据备份</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  导出所有表的数据到本地文件
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleExportSQL}
                    disabled={state.isLoading}
                    className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    <span>导出为SQL文件</span>
                  </button>
                  <button
                    onClick={handleExportJSON}
                    disabled={state.isLoading}
                    className="w-full px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    <span>导出为JSON文件</span>
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">数据恢复</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  从备份文件恢复数据，将覆盖现有数据
                </p>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.sql"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={state.isLoading}
                    className="w-full px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Upload size={16} />
                    <span>选择备份文件</span>
                  </button>
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                    支持 .json 和 .sql 格式
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                警告：恢复数据将覆盖当前数据库中的所有现有数据，请在操作前确保已备份重要数据。
              </p>
            </div>
          </div>
        </div>

        <Modal
          isOpen={state.showRestoreDialog}
          title="确认恢复数据"
          onClose={handleCancelRestore}
          confirmText="确认恢复"
          onConfirm={handleRestore}
          confirmDisabled={state.isLoading}
        >
          <p className="text-gray-600 dark:text-gray-300">
            恢复数据将覆盖当前数据库中的所有现有数据，此操作不可撤销。是否继续？
          </p>
        </Modal>
      </div>
    </div>
  )
}

export default DatabasePage