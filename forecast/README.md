# Forecast v0.1

15 分钟粒度的流动性预测沙盘。它不是 LLM 预测；LLM 只调用 `forecast.run`，读取工具 observation。

## 文件

- `generate-history.mjs`：生成 90 天、15 分钟粒度的沙盘历史 `history.json`
- `scenario.json`：as-of 时点、当前 CIPS 余额、最低保留、计划内大额付款
- `engine.mjs`：季节性基线 + 残差 bootstrap，输出 P50/P72/P95
- `backtest.mjs`：滚动回测，生成 `backtest.json`
- `build-snapshot.mjs`：生成浏览器可读取的 `snapshot.js`
- `snapshot.js`：首页 Agent 轨迹使用的预测快照

## 运行

```bash
node forecast/generate-history.mjs
node forecast/backtest.mjs
node forecast/build-snapshot.mjs
```

## 输出字段

```json
{
  "as_of": "2026-10-19T10:42:00+08:00",
  "gap_yi": 2.86,
  "at": "16:30",
  "p50_yi": 2.58,
  "p72_yi": 2.86,
  "p95_yi": 3.36,
  "coverage_p72": 0.71,
  "model_version": "forecast-v0.1-seasonal-bootstrap",
  "source": "sandbox 90d 15min history + residual bootstrap"
}
```

## 边界

- 历史数据是沙盘历史，不是生产 CIPS/CNAPS/TREATS 数据。
- 回测指标是沙盘回测，不是生产验证。
- `P72` 是 72% 分位，不是 72 条路径。
- 计划内大额付款来自 `scenario.json`，生产环境应来自付款日历和队列。
