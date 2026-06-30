// ===== 导出 / 导入面板 =====
// 导出:把当前 store 数据序列化为 JSON 并触发下载。
// 导入:选择 .json 文件,覆盖当前 store(含主线 + 卡片)。

import { useTaskStore } from '../store/taskStore';

export default function ExportImportPanel() {
  const exportData = () => {
    const { mainTasks, subTasks } = useTaskStore.getState();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      mainTasks,
      subTasks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-canvas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (
          data &&
          Array.isArray(data.mainTasks) &&
          Array.isArray(data.subTasks)
        ) {
          useTaskStore.setState({
            mainTasks: data.mainTasks,
            subTasks: data.subTasks,
          });
          // Zustand persist 会自动把新数据写回 localStorage
        } else {
          alert('文件格式不符:需要包含 mainTasks 和 subTasks 数组');
        }
      } catch {
        alert('导入失败:文件不是有效的 JSON');
      }
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', gap: 6, padding: 6 }}>
      <button
        className="toolbar-button"
        onClick={exportData}
        title="导出数据为 JSON 文件"
      >
        ↓ 备份
      </button>
      <button
        className="toolbar-button"
        onClick={importData}
        title="从 JSON 文件导入数据"
      >
        ↑ 恢复
      </button>
    </div>
  );
}
