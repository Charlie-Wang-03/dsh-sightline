<p align="right">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

# Sightline

**同一个仓库，不同的 Agent，不同的规则。**

在同一个仓库、同一个工作目录下，直接比较 DeepSeek Harness 实际加载了哪些工作区指令，以及 Codex 和 Claude Code 按各自规则会加载哪些指令。

> **状态：v0.1.0。** 首个公开版本现已通过 npm 与 GitHub Releases 发布。核心比较、DSH 运行时观测、Codex / Claude 预测、可安装的 DSH Bundle、clean-profile 验证以及专用 DSH Web ToolView 均已实现并测试。

## 为什么需要 Sightline

一个仓库可能同时存在：

- `AGENTS.md`；
- `CLAUDE.md`；
- 嵌套目录中的局部指令；
- 用户级全局指令；
- `.claude/rules/`。

DeepSeek Harness、Codex 和 Claude Code 并不会以完全相同的方式发现和加载这些内容。

结果是：

> 你以为一个仓库只有一套 AI 指令，实际上不同 Coding Agent 看到的可能是三套不同的有效指令面。

Sightline 把这种原本隐藏的差异放到一张表里。

## 你会看到什么

```text
Same repo. Different agents. Different rules.

                    DSH        Codex       Claude
                  Observed    Predicted    Predicted
AGENTS.md             ●           ●
CLAUDE.md              ●                       ●
packages/api/AGENTS.md ●           ●
.claude/rules/always.md                         ●
```

DSH Web ToolView 使用同一份 canonical report，并明确显示 `Observed` / `Predicted` / `Unavailable` 与 `Present` / `Absent` / `Unknown` 状态。

| Agent | v0.1 证据类型 |
| --- | --- |
| DeepSeek Harness | 在可用时，从当前 DSH Session 的持久化 typed instruction provenance 中获得 **Observed** 证据 |
| Codex | 根据公开规则与本地文件推导 **Predicted** 结果 |
| Claude Code | 根据公开 memory / rules 语义与本地文件推导 **Predicted** 结果 |

Sightline 不会把预测结果包装成运行时观测事实。

## 安装

v0.1 的主要公开分发方式是预构建 npm 包：

```sh
dsh plugin --profile web add dsh-sightline@0.1.0
```

该包已在 npm 发布为 `dsh-sightline@0.1.0`。从源码或本地 tarball 开发时，请阅读 [`docs/PACKAGING.md`](docs/PACKAGING.md)。

## 使用

安装后启动 DSH Web：

```sh
dsh web
```

在一个位于 Git 仓库中的 DSH Session 里，可以直接让 Agent 调用 `sightline`，例如：

```text
Use sightline and tell me where the DSH, Codex, and Claude instruction views diverge.
```

Sightline 会基于同一个实时 Session `cwd` 与同一个仓库根目录解析三列结果。

## v0.1 做什么

1. **Discover**：发现与三类 Agent 相关的指令来源；
2. **Resolve**：分别得到三类 Agent 的有效指令面；
3. **Compare**：使用确定性的结构规则比较差异；
4. **Visualize**：在 DSH 中展示一致、分歧与未知状态。

首个版本刻意不做：

- 指令质量评分；
- LLM 语义冲突检测；
- 自动重写或同步 `AGENTS.md` / `CLAUDE.md`；
- token 优化；
- CI drift gate；
- 对模型是否真正遵循某条指令作保证。

## 架构

```text
live DSH tool call + workspace
            |
            +---- exec.agent.session ----> DSH adapter ------ Observed ----+
            |                                                              |
            +---- ctx.fs ---------------> Codex adapter ---- Predicted ----+--> canonical report
            |                                                              |
            +---- ctx.fs ---------------> Claude adapter --- Predicted ----+
                                                                           |
                                                                           +--> model-facing projection
                                                                           +--> DSH Web ToolView
```

不同 Agent 的发现与优先级语义都封装在各自 adapter 中；比较层本身保持纯函数、与具体 Agent 无关。DSH Hosted 模式下的文件系统读取通过公开 `ctx.fs` capability 完成。

## 隐私与信任边界

Sightline 是 local-first、read-only 工具，但 **local-first 并不意味着所有 DSH Tool Result 永远不会离开本机**。

- Sightline 自身不会调用任何 Sightline 自有的远程服务；
- Sightline 不会修改工作区指令文件；
- 完整 canonical report 会作为 DSH Tool metadata 保留，供 Web ToolView 与 replay 使用，其中包含 `repositoryRoot` / `cwd` 等工作区身份信息；ToolView 可能显示绝对 Session `cwd` 与完整 diagnostic message。任何能够访问该 DSH Web Session 的人都可能看到这些信息，其访问控制由 DSH Web 自身负责；
- **发送给模型的文本投影更窄**：默认只包含 source identity、evidence label、presence state 与 diagnostic code，并省略绝对工作区路径和完整 diagnostic message；
- 这部分 model-facing output 与其他 DSH Tool output 一样，由当前 Session 配置的模型 / Provider 处理；
- Sightline 不会把指令文件正文上传到 Sightline 自有服务。

完整边界见 [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) 与 [`SECURITY.md`](SECURITY.md)。

## 兼容性

v0.1 当前验证基线：

- DeepSeek Harness `0.1.1-rc.2`；
- upstream DSH commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`；
- Node `^22.19.0 || >=24.0.0`；
- pnpm `11.7.0`。

DSH 仍处于 Developer Preview，因此 Sightline 只声明**实际验证过的版本兼容性**，不对未验证的新版本做宽泛承诺。

Codex 与 Claude Code adapter 同样保留独立的 compatibility identity。对于 Claude path-scoped rules，如果仅凭 `cwd` 不能确定规则已经激活，Sightline 会保守地标记为 deferred，而不是猜测。

详见 [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md)。

## 验证

当前自动化覆盖包括：

- package / bundle / client surface；
- Codex 全局、项目、嵌套、override、fallback 与 byte budget；
- Claude user / project memory 与 always-loaded rules；
- Claude path-scoped rule 的 fail-closed 行为；
- DSH durable provenance folding；
- 真实 `ToolRuntime + SessionStore + dsh-fs-local` Host 集成；
- canonical 三列表生成；
- clean-profile packed-artifact 安装与导出解析；
- browser ToolView 注册 / 渲染 smoke；
- Windows / POSIX 路径归一化。

本地验证命令：

```sh
pnpm run check
```

## 文档

| 文档 | 作用 |
| --- | --- |
| [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) | v0.1 产品、证据、隐私与非目标边界 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 系统边界与数据模型 |
| [`docs/DSH_RUNTIME_SEAM.md`](docs/DSH_RUNTIME_SEAM.md) | DSH authoritative provenance seam |
| [`docs/DSH_HOST_TOOL.md`](docs/DSH_HOST_TOOL.md) | live Session ownership 与文件系统绑定 |
| [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) | resolver / runtime compatibility identity |
| [`docs/PACKAGING.md`](docs/PACKAGING.md) | npm / bundle 打包与 clean-profile 验证 |
| [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) | v0.1 公开发布 Gate |

## 贡献

欢迎高质量 Issue 和聚焦的 Pull Request。进行非小型修改前，请先阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md) 与 [`AGENTS.md`](AGENTS.md)。

安全问题请按 [`SECURITY.md`](SECURITY.md) 的方式报告。

## License

MIT，见 [`LICENSE`](LICENSE)。

## 项目关系

Sightline 是 DeepSeek Harness 生态中的独立社区项目，并非 DeepSeek 官方产品；除非 DeepSeek 官方明确说明，否则不代表任何官方认可或背书。
