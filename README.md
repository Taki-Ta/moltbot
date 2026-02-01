# Moltbot CN

本仓库是 [OpenClaw/Moltbot](https://github.com/openclaw/openclaw) 的 Fork，添加了 **QQ 私聊支持**，通过 [NapCatQQ](https://github.com/NapNeko/NapCatQQ) + OneBot v11 协议实现。

> ⚠️ **安全说明**: 本插件仅支持私聊，不支持群聊。因为群聊会将你的电脑环境暴露给所有群成员，存在安全风险。

## 为什么采用这种方式？

我们考虑过两种方案：

| 方案 | 架构 | 优缺点 |
|------|------|--------|
| **内置扩展 (本方案)** | NapCat → moltbot_cn | ✅ 架构简单，只需两个组件<br>✅ 功能完整（图片、输入状态等）<br>✅ 安装简单 |
| 独立桥接 | NapCat → bridge → moltbot | ❌ 需要额外维护桥接服务<br>❌ 架构复杂度高 |

最终选择**内置扩展**方案，因为它最简单、最易维护。

## 安装

```bash
# 安装本 Fork（包含 QQ 支持）
npm install -g @takibeiy/moltbot_cn@latest

# 或使用 beta 版本
npm install -g @takibeiy/moltbot_cn@beta
```

## 配置 NapCatQQ

1. **下载安装 NapCatQQ**
   - 前往 [NapCatQQ Releases](https://github.com/NapNeko/NapCatQQ/releases) 下载
   - 支持 Windows / Linux / macOS

2. **启动 NapCat 并登录 QQ**
   ```bash
   # Linux/macOS
   ./NapCat

   # Windows
   NapCat.exe
   ```

3. **配置 OneBot WebSocket 反向连接**

   在 NapCat 的 WebUI (通常是 `http://127.0.0.1:6099`) 中配置：

   - 打开 **网络配置** → **添加配置**
   - 类型选择 **WebSocket 反向**
   - 地址填写：`ws://127.0.0.1:3001` (或你指定的端口)
   - 保存并启用

## 配置 Moltbot

编辑配置文件 `~/.moltbot/moltbot.json`：

```json
{
  "gateway": {
    "port": 18789,
    "auth": "your-secret-token"
  },
  "channels": {
    "qq": {
      "enabled": true,
      "wsUrl": "ws://127.0.0.1:3001",
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  }
}
```

**配置说明：**

| 配置项 | 说明 |
|--------|------|
| `wsUrl` | OneBot WebSocket 地址，需与 NapCat 配置一致 |
| `dmPolicy` | 私聊策略：`open`（开放）、`pairing`（需配对）、`allowlist`（白名单） |
| `allowFrom` | 允许的私聊用户 QQ 号，`["*"]` 表示所有人（需 `dmPolicy: "open"`） |

## 启动服务

```bash
# 1. 确保 NapCat 已启动并登录

# 2. 启动 moltbot gateway
moltbot gateway run

# 3. 检查 QQ 连接状态
moltbot channels status
```

## 功能支持

- ✅ 私聊消息收发
- ✅ 图片发送（自动 base64 转换）
- ✅ 输入状态指示器（显示"对方正在输入..."）
- ✅ 消息撤回
- ⬜ 语音消息（计划中）
- ❌ 群聊（出于安全考虑不支持）

## 常见问题

**Q: 连接失败怎么办？**
- 检查 NapCat 是否已启动并登录
- 检查 WebSocket 端口是否一致
- 查看 `moltbot gateway run --verbose` 输出

**Q: 图片发送失败？**
- 本 Fork 会自动将图片转换为 base64 格式
- 确保图片 URL 可访问

**Q: 为什么不支持群聊？**
- 群聊会将你的电脑环境（通过 AI agent 的工具调用）暴露给所有群成员
- 任何群成员都可以让 bot 执行命令，存在严重安全风险
- 如需群聊功能，请自行评估风险并修改代码

## 上游同步

本 Fork 会定期从上游 [OpenClaw](https://github.com/openclaw/openclaw) 同步更新。

## License

MIT
