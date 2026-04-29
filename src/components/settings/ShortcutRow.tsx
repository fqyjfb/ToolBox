import React, { useState } from 'react';
import { ShortcutItem } from '../../types/settings';

interface ShortcutRowProps {
  shortcut: ShortcutItem;
  onUpdate: (shortcut: ShortcutItem) => void;
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ shortcut, onUpdate }) => {
  const [currentKey, setCurrentKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const displayKey = currentKey || shortcut.cmd.replace(/CommandOrControl/gi, 'Ctrl');

  const capitalize = (str: string) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const modifiers: string[] = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    if (modifiers.length >= 3 || modifiers.length < 1) return;

    let key = e.key === ' ' ? 'Space' : capitalize(e.key);
    key = key.replace(/^Arrow/, '');

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;

    const newShortcut = [...modifiers, key].join('+');
    setCurrentKey(newShortcut);
  };

  const handleKeyUp = () => {
    if (currentKey) {
      const cmdKey = currentKey.replace(/Ctrl/gi, 'CommandOrControl');
      const updatedShortcut = { ...shortcut, cmd: cmdKey };
      onUpdate(updatedShortcut);
      setIsEditing(false);
    } else {
      setCurrentKey('');
    }
  };

  const handleToggle = () => {
    const updatedShortcut = { ...shortcut, isOpen: shortcut.isOpen === 1 ? 0 : 1 };
    onUpdate(updatedShortcut);
  };

  return (
    <div className={`flex items-center justify-between py-2 px-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isEditing ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {shortcut.tag}
        </span>
      </div>
      <div className="w-48 mr-4">
        <input
          type="text"
          value={displayKey}
          onChange={() => {}}
          onFocus={() => { setIsEditing(true); setCurrentKey(''); }}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={() => setIsEditing(false)}
          className={`w-full px-3 py-1.5 text-sm text-center border rounded-md transition-colors ${
            isEditing
              ? 'border-primary bg-gray-50 dark:bg-gray-700 outline-none'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer'
          } text-gray-700 dark:text-gray-300`}
          placeholder="按快捷键"
        />
      </div>
      <button
        onClick={handleToggle}
        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-1.5 focus:ring-offset-1.5 focus:ring-primary ${
          shortcut.isOpen === 1 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 transform rounded-full transition-transform ${
            shortcut.isOpen === 1 ? 'translate-x-5' : 'translate-x-1'
          }`}
          style={{ backgroundColor: 'white' }}
        />
      </button>
    </div>
  );
};

export default ShortcutRow;
