import { useState } from "react";

const MAX_ROWS = 8;
const MAX_COLS = 8;

export interface TablePickerProps {
  onPick: (rows: number, cols: number) => void;
  onClose: () => void;
}

/** 表格尺寸选择器：内嵌面板的静态区块，网格 hover 高亮，点击插入 */
export function TablePicker({ onPick, onClose }: TablePickerProps) {
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);

  return (
    <div className="mde-table-picker" role="group" aria-label="选择表格尺寸">
      <div className="mde-table-label">
        {rows > 0 && cols > 0 ? `${rows} × ${cols}` : "选择表格尺寸"}
      </div>
      <div
        className="mde-table-grid"
        onMouseLeave={() => {
          setRows(0);
          setCols(0);
        }}
      >
        {Array.from({ length: MAX_ROWS }, (_, row) =>
          Array.from({ length: MAX_COLS }, (_, col) => (
            <button
              key={`${row}-${col}`}
              type="button"
              className={row < rows && col < cols ? "mde-cell is-on" : "mde-cell"}
              aria-label={`${row + 1} 行 ${col + 1} 列`}
              onMouseEnter={() => {
                setRows(row + 1);
                setCols(col + 1);
              }}
              onClick={() => {
                onPick(row + 1, col + 1);
                onClose();
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}
