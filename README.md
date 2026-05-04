<div align="center">

# ◈ VoidShell ◈

![macOS](https://img.shields.io/badge/Platform-macOS-black?style=for-the-badge&logo=apple)
![Electron](https://img.shields.io/badge/Electron-28-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-r160-049EF4?style=for-the-badge&logo=threedotjs)
![Java](https://img.shields.io/badge/Java-11+-ED8B00?style=for-the-badge&logo=openjdk)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

> ***A psychological horror aesthetic terminal emulator.***
>
> *融合"心理恐怖/黑深残"美学的全栈终端仿真器*

---

![VoidShell Preview](./assets/preview.gif)


---

</div>

## 📑 目录

- [核心特性](#-核心特性-the-soul)
- [技术栈](#-技术栈-core-stack)
- [快速开始](#-快速开始-quick-start)
- [架构说明](#-架构说明-architecture)
- [美学设计](#-美学设计细节-aesthetic-details)
- [项目状态](#-项目状态)
- [许可证](#-许可证)

---

## 🩸 核心特性 (The Soul)

| 特性 | 描述 |
|:---|:---|
| **动态虚空背景** | 基于 WebGL Shader 渲染的暗紫色/深红色蠕动组织（灵感来自《Carrion》），速度和颜色根据 CPU/内存负载实时变化 |
| **坏疽反馈** | 实时监控终端输出流，检测 `Error`/`Exception`/`FATAL` 时触发 500ms 位图畸变和红色噪点闪烁 |
| **打字机灵魂** | 字符输入时带有轻微模糊渐入效果，仿佛灵魂注入屏幕 |
| **Java 性能监控** | 独立 Java 进程通过 TCP Socket 实时推送 CPU/Memory 指标，驱动前端视觉表现 |
| **原生终端体验** | 基于 `xterm.js` + `node-pty`，完美支持 zsh/bash |

---

## 🔧 技术栈 (Core Stack)

<div align="center">

| 模块 | 技术选型 | 职责 |
|:---:|:---|:---|
| **Frontend** | `React 18` + `Vite` | UI 渲染、状态管理、Glitch 特效逻辑 |
| **Terminal** | `xterm.js` + `WebGL Addon` | 终端仿真引擎、ANSI 解析、打字机特效 |
| **Visuals** | `Three.js` + `GLSL Shaders` | 渲染全屏 Shader 背景（蠕动组织效果） |
| **Backend** | `Electron` + `node-pty` | 窗口管理、IPC 通信、对接系统 Shell |
| **Sidecar** | `Java 11` (JMX) | 独立进程，监控 CPU/内存，通过 Socket 推送 JSON |

</div>

---

## 🚀 快速开始 (Quick Start)

### 环境要求

```
Node.js    v18+
Java       JDK 11+
macOS      推荐 M4 芯片优化
```

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/kenamino/VoidShell.git
cd VoidShell

# 2. 安装依赖
npm install

# 3. 启动开发环境
npm run dev
```

<details>
<summary>📦 手动编译 Java Sidecar（可选）</summary>

```bash
cd java-sidecar
make jar
```

> Java 监控服务会在 Electron 启动时自动编译和运行

</details>

<details>
<summary>📀 打包应用</summary>

```bash
npm run build
```

打包后的应用将生成在 `dist` 和 `release` 目录中。

</details>

---

## 🏗️ 架构说明 (Architecture)

VoidShell 采用**三层架构**设计：

```
┌─────────────────────────────────────────────────────────────┐
│                   React Renderer (Presentation)             │
│  ┌─────────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ VoidBackground  │  │  Terminal    │  │ GlitchDetector │  │
│  │   (Shader BG)   │  │  (xterm.js) │  │ (Error→Glitch) │  │
│  └────────┬────────┘  └──────┬──────┘  └────────┬───────┘  │
└───────────┼──────────────────┼──────────────────┼───────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main (Bridge)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  node-pty (Shell I/O)  ←→  TCP Client (Sidecar)    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Java Sidecar (Data)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ManagementFactory → CPU/Memory → JSON @ :27182     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 职责 |
|:---|:---|
| `VoidBackground.tsx` | 接收 CPU/内存数据，更新 Shader Uniforms |
| `Terminal.tsx` | 渲染 xterm.js，将输出流传递给 Glitch 探测器 |
| `useGlitchDetector.ts` | 正则匹配错误关键字，触发 CSS 动画和 Canvas 噪点 |

---

## 🎨 美学设计细节 (Aesthetic Details)

<div align="center">

### 色彩调色板

| 色彩 | Hex | 用途 |
|:---:|:---:|:---|
| ⬛ | `#0a0008` | Void Black - 底色 |
| 🟪 | `#9d4edd` | Void Accent - 强调色 |
| 🟥 | `#ff2244` | Error Red - 错误反馈 |

</div>

### Shader 优化
针对 M4 GPU，采用多层 **FBM (Fractional Brownian Motion)** 域扭曲算法，在保证 **60FPS** 的同时呈现出有机的肉体蠕动感。

### 无边框沉浸
采用 macOS `hiddenInset` 标题栏，去除所有原生窗口边框，配合半透明毛玻璃效果，让终端完全融入虚空背景。

---

## 🚧 项目状态

> ⚠️ **本项目仍在积极开发中**，API 和功能可能随时变动。

---

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 许可。

---

<div align="center">

*Created by [kenamino](https://github.com/kenamino)*

🕸️ ***Embrace the void.*** 👁️‍🗨️

</div>
