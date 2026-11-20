# CIPS Sentinel 运行说明

本文说明从零安装、配置、启动、验证和常见故障处理。

---

## 1. 环境要求

### 必需

| 环境 | 版本 | 用途 |
|---|---|---|
| Node.js | **20+**，推荐 22 LTS | 运行 `server.mjs`、静态页面、Agent 工具 |
| 浏览器 | Chrome / Edge | 打开页面 |
| Git | 任意近期版本 | 克隆仓库 |

服务端是零依赖 Node ESM，**不需要 `npm install`**。

检查：

```bash
node -v
npm -v
git --version
```

### 可选

| 环境 | 用途 |
|---|---|
| Ollama | 本地模型推理 |
| Python 3.10+ | 仅重新生成 Office 文档时使用 |
| Docker | 容器化运行 |

---

## 2. 获取代码

```bash
git clone https://github.com/cxkyang/CIPS-Sentinel.git
cd CIPS-Sentinel
```

---

## 3. 配置环境变量

复制样例：

macOS / Linux：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

打开 `.env.local`，按演示方式选择：

### 方式 A：Mock（最稳定，推荐舞台演示）

```env
LLM_PROVIDER=mock
```

不调用外部模型，Agent 走确定性沙盘轨迹。

### 方式 B：OpenAI-compatible

```env
LLM_PROVIDER=openai
LLM_BASE_URL=https://your-gateway.example.com/v1
LLM_API_KEY=your-api-key
LLM_MODEL=qwen-plus
```

兼容阿里云 MaaS、DeepSeek、行内模型网关等 OpenAI-compatible 接口。

### 方式 C：本地 Ollama

```bash
ollama serve
ollama pull qwen2.5:7b
```

`.env.local`：

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=qwen2.5:7b
```

### 方式 D：auto

```env
LLM_PROVIDER=auto
```

服务端会按配置探测可用 provider；不可用时回退到 Mock。

> **安全要求**：`.env.local` 已被 `.gitignore` 忽略，不要提交 API Key。

---

## 4. 启动服务

### macOS / Linux

```bash
chmod +x run.sh
./run.sh
```

或直接：

```bash
node server.mjs
```

### Windows PowerShell

```powershell
node server.mjs
```

### 使用 npm script

```bash
npm start
```

默认监听：

```text
http://127.0.0.1:8787
```

终端应出现：

```text
LQ-Agent server: http://127.0.0.1:8787 (bind 127.0.0.1)
```

---

## 5. 打开页面

| 页面 | 地址 |
|---|---|
| 首页 / 指挥舱 | `http://127.0.0.1:8787/` |
| CNAPS / CIPS 对账 | `http://127.0.0.1:8787/recon.html` |
| 分行头寸 | `http://127.0.0.1:8787/tops.html` |
| Agent Console | `http://127.0.0.1:8787/live.html` |
| 需求说明书 | `http://127.0.0.1:8787/CIPS-Sentinel-需求说明书-v1.0.pdf` |

数据/文档入口：

- `docs/` 下为需求说明书、设计书、路演 Deck；
- 首页为确定性演示；
- Agent Console 可选择 Mock / OpenAI 兼容 / Ollama。

---

## 6. 验证服务

```bash
curl http://127.0.0.1:8787/api/health
```

应返回：

```json
{"ok":true,"defaultProvider":"mock", ...}
```

Windows PowerShell：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

检查端口：

macOS / Linux：

```bash
lsof -i :8787
```

Windows：

```powershell
netstat -ano | findstr :8787
```

---

## 7. 使用 Agent Console

1. 打开 `/live.html`；
2. 选择 provider：自动 / OpenAI 兼容 / Ollama / Mock；
3. 点击「运行真实推演」；
4. 观察 SSE 轨迹：
   - `thought`
   - `tool_call`
   - `tool_result`
   - `approval_required`
   - `execution`
   - `execution_confirmed`
   - `final`
5. 遇到 MKTY 授权时，页面会暂停，批准后继续；
6. 模型不可用或步数预算用尽时，服务端会收口 final 或回退 Mock。

相关限制：

```env
MAX_AGENT_STEPS=16
LLM_TIMEOUT_MS=60000
APPROVAL_TIMEOUT_MS=120000
```

---

## 8. 预测数据重新生成

在项目根目录运行：

```bash
node forecast/generate-history.mjs
node forecast/backtest.mjs
node forecast/build-snapshot.mjs
```

CNAPS 来账趋势：

```bash
node forecast/generate-cnaps-inflow.mjs
node forecast/cnaps-inflow-engine.mjs
node forecast/generate-cnaps-customers.mjs
node forecast/cnaps-inflow-engine.mjs
```

生成后刷新页面。当前数据均为沙盘数据。

---

## 9. Docker（可选）

构建：

```bash
docker build -t cips-sentinel .
```

运行：

```bash
docker run --rm \
  -p 8787:8787 \
  --env-file .env.local \
  cips-sentinel
```

浏览器打开：

```text
http://127.0.0.1:8787/
```

`.env.local` 不会被复制进镜像；通过 `--env-file` 注入。

---

## 10. 局域网/服务器访问

默认只绑定 `127.0.0.1`。如需局域网访问：

```env
HOST=0.0.0.0
PORT=8787
```

然后重启：

```bash
node server.mjs
```

确保：

- 防火墙放行 8787；
- 仅在受控网络中使用；
- 不要把带 API Key 的 `.env.local` 提交或发给他人；
- 生产部署应放在反向代理、TLS 和访问控制之后。

---

## 11. 常见问题

### 端口被占用

```bash
# macOS / Linux
lsof -i :8787
kill <PID>

# Windows
netstat -ano | findstr :8787
taskkill /PID <PID> /F
```

或改用：

```env
PORT=8788
```

### 页面提示「服务未启动」

确认：

```bash
curl http://127.0.0.1:8787/api/health
```

如果失败，检查 `node server.mjs` 终端是否仍在运行。

### Agent Console 一直回退 Mock

检查：

- `LLM_API_KEY` 是否配置；
- `LLM_BASE_URL` 是否可达；
- 网络/代理是否允许访问模型网关；
- `GET /api/health` 中的 provider 状态。

### 出现「步数预算用尽」

服务端默认 16 步，并会自动收口 final。如果仍频繁出现，检查是否重复调用工具，或在 `.env.local` 中调高：

```env
MAX_AGENT_STEPS=20
```

### 页面样式未更新

浏览器强制刷新：

```text
Ctrl + Shift + R
```

### 文档打不开

确认 `docs/` 已完整克隆：

```bash
ls docs/
```

需求说明书 PDF 可直接浏览器打开；PPTX 需要 PowerPoint / WPS / Keynote。

---

## 12. 数据与合规

- 本项目只使用 Mock / 沙盘数据；
- 不连接真实 CIPS、CNAPS、TREATS、GPE；
- 不发送真实支付、调拨或回购；
- 预测、客户机会和收益数字均为演示数据；
- 生产化需另行完成数据授权、SSO/RBAC、审批矩阵、模型治理、审计库和幂等/原子预占。
