import React from 'react';
import './TodoCheckbox.css';

interface TodoCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const TodoCheckbox: React.FC<TodoCheckboxProps> = ({ checked, onChange }) => {
  return (
    <div className="todo-checkbox-wrapper flex-shrink-0 mt-1 mr-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="todo-checkbox"
      />
      <span className="absolute -left-9999" />
    </div>
  );
};

export default TodoCheckbox;
