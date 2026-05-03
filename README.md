# VoidShell ◈

> *A psychological horror aesthetic terminal emulator.*

VoidShell 是一个融合了“心理恐怖/黑深残”美学的全栈终端仿真器。它不仅是一个功能完备的 Terminal，更是一个能够感知系统状态、对错误产生“坏疽反馈”的数字艺术品。

本项目专为 macOS (Apple Silicon M4) 优化，采用 Electron + React + Three.js + Java Sidecar 架构。

## 核心特性 (The Soul)

- **动态虚空背景 (The Void)**: 基于 WebGL Shader 渲染的暗紫色/深红色蠕动组织（灵感来自《Carrion》）。背景的蠕动速度和颜色深度会根据系统 CPU 和内存负载实时变化。
- **坏疽反馈 (Glitch Art)**: 实时监控终端输出流。当检测到 `Error`, `Exception`, `FATAL` 等关键字时，终端会触发 500ms 的位图畸变（Glitch）和红色噪点闪烁。
- **打字机灵魂 (Typing Soul)**: 字符输入时带有轻微的模糊渐入效果，仿佛灵魂注入屏幕。
- **Java 性能监控 (The Sidecar)**: 独立的 Java 进程通过 TCP Socket 实时推送系统底层性能指标（CPU/Memory），驱动前端视觉表现。
- **原生终端体验**: 基于 `xterm.js` 和 `node-pty`，完美支持 zsh/bash，适配 macOS 路径和环境变量。

## 技术栈 (Core Stack)

| 模块 | 技术选型 | 职责 |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | UI 渲染、状态管理、Glitch 特效逻辑 |
| **Terminal** | xterm.js + WebGL Addon | 终端仿真引擎、ANSI 解析、打字机特效 |
| **Visuals** | Three.js + GLSL Shaders | 渲染全屏 Shader 背景（蠕动组织效果） |
| **Backend** | Electron + node-pty | 窗口管理、IPC 通信、对接系统 Shell |
| **Sidecar** | Java 11 (JMX) | 独立进程，监控 CPU/内存，通过 Socket 推送 JSON |

## 快速开始 (Quick Start)

### 环境要求
- Node.js (v18+)
- Java (JDK 11+)
- macOS (M4 芯片优化，但也兼容其他平台)

### 1. 安装依赖

```bash
cd VoidShell
npm install
```

### 2. 编译 Java Sidecar

Java 监控服务会在 Electron 启动时自动编译和运行，但你也可以手动编译测试：

```bash
cd java-sidecar
make jar
```

### 3. 启动开发环境

```bash
npm run dev
```

这会同时启动 Vite 开发服务器和 Electron 主进程。

### 4. 打包应用

```bash
npm run build
```

打包后的应用将生成在 `dist` 和 `release` 目录中。

## 架构说明 (Architecture)

VoidShell 采用三层架构设计：

1. **Java Sidecar (Data Layer)**:
   - 使用 `ManagementFactory` 获取底层 OS 指标。
   - 监听 `27182` 端口，每秒推送一次 JSON 格式的性能数据。
2. **Electron Main (Bridge Layer)**:
   - 管理 `node-pty` 进程，建立与系统 Shell 的双向管道。
   - 维护与 Java Sidecar 的 TCP 连接。
   - 通过 IPC 将 Shell 输出和性能数据转发给渲染进程。
3. **React Renderer (Presentation Layer)**:
   - `VoidBackground.tsx`: 接收 CPU/内存数据，更新 Shader Uniforms。
   - `Terminal.tsx`: 渲染 xterm.js，将输出流传递给 Glitch 探测器。
   - `useGlitchDetector.ts`: 正则匹配错误关键字，触发 CSS 动画和 Canvas 噪点覆盖层。

## 美学设计细节 (Aesthetic Details)

- **色彩调色板**: 以 `#0a0008` (Void Black) 为底色，辅以 `#9d4edd` (Void Accent) 和 `#ff2244` (Error Red)。
- **Shader 优化**: 针对 M4 GPU，Shader 采用了多层 FBM (Fractional Brownian Motion) 域扭曲算法，在保证 60FPS 的同时呈现出有机的肉体蠕动感。
- **无边框沉浸**: 采用 macOS `hiddenInset` 标题栏，去除了所有原生窗口边框，配合半透明毛玻璃效果，让终端完全融入虚空背景。

---
*Created by Manus AI.*
