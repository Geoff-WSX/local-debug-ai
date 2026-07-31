# 已知问题

## 1. 侧边栏切换 Tab 不会自动关闭

**状态：** 未解决

**描述：**
Chrome Side Panel API 的设计是侧边栏生命周期独立于标签页，切换 Tab 后侧边栏仍然保持打开状态。

**尝试过的方案：**

| 方案 | 结果 |
|------|------|
| `chrome.sidePanel.close()` 在 `tabs.onActivated` 中调用 | Chrome 不一定执行关闭，部分版本忽略该调用 |
| `chrome.sidePanel.setOptions({ tabId, enabled: false })` | **不可用** — 该 API 持久化到 Chrome 内部存储，一旦禁用某个 Tab，即使用户移除重装插件也无法恢复 |
| 手动跟踪 `panelTabId` + `action.onClicked` | 逻辑过于复杂且不稳定 |

**影响：**
- 在 localhost 打开侧边栏后，切换到其他页面侧边栏仍然可见
- 仅影响使用体验，不影响功能（录制、AI 分析等正常工作）

**可能的长期方向：**
- 等待 Chrome 官方在 Side Panel API 中提供"仅当前 Tab 显示"的原生选项
- 或者改用 Popup（弹窗）方案替代 Side Panel
