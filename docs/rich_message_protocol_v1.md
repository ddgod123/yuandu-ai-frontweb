# 视频转图片 · 富交互消息协议（草案）

> 版本：`ui_message_v1`  
> 代码定义：`src/types/rich-message.ts`

## 1. 目标

统一前后端在「AI 交互工作台」中的消息结构，让前端可以按 `type` 动态渲染富组件，而不是只渲染纯文本日志。

## 2. 基础信封结构

```json
{
  "schema_version": "ui_message_v1",
  "message": {
    "id": "msg_123",
    "role": "assistant",
    "type": "ai1_plan_card",
    "created_at": 1761234567890,
    "content": "",
    "payload": {},
    "actions": []
  }
}
```

## 3. 首批消息类型

1. `upload_progress`：任务进度卡片  
2. `ai1_plan_card`：AI1 提案卡片  
3. `processing_status`：处理中状态卡片  
4. `final_gallery`：结果画廊卡片  

## 4. 兼容策略

- 若 `type` 未识别，前端降级按 `text` 渲染。
- 若 `payload` 缺失，前端渲染空状态而不报错。
- `actions` 为可选字段，前端按 `action.key` 分发处理。

## 5. 当前落地点

- 组件目录：`src/components/create/rich-message`
- 调试工作台接入：`src/app/create/page.tsx`（AI1 调试视图 → 时序视图）

