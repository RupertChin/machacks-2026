<div align="center">

<!-- LOGO: Replace with your logo image -->
<!-- <img src="docs/assets/logo.png" alt="CADence Logo" width="120" /> -->

# ⚡ CADence

### Design 3D Parts with Your Hands and Voice

[![1st Place](https://img.shields.io/badge/%F0%9F%8F%86_1st_Place-MACHacks_2026-gold?style=for-the-badge)](https://machacks.io)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Three.js](https://img.shields.io/badge/Three.js-0.162-black?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Claude](https://img.shields.io/badge/Claude-Anthropic-7C3AED?style=flat-square)](https://anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)

An AI-powered CAD editor that understands hand gestures, voice commands, and engineering spec sheets. No mouse required.

<!-- HERO IMAGE: Replace with a screenshot or demo GIF of the full app -->
<!-- <img src="docs/assets/hero.gif" alt="CADence Demo" width="800" /> -->

[Try CADence](#getting-started) · [Features](#features) · [Architecture](#architecture) · [Team](#team)

</div>

---

## The Pitch

Traditional CAD tools demand hours of training and mouse-heavy workflows. **CADence** flips the script:

1. **Upload** an engineering spec sheet (PDF) — dimensions, tolerances, and constraints are extracted automatically
2. **Speak** your design intent — *"Build a case for this Raspberry Pi with ventilation slots"*
3. **Navigate** with hand gestures — pinch to zoom, swipe to orbit, fist to reset
4. **Export** production-ready STL files for 3D printing

All powered by a Claude AI agent that reasons about your constraints in real-time.

---

## Demo

<!-- Replace these placeholders with your actual screenshots/GIFs -->

<div align="center">
<table>
<tr>
<td align="center" width="50%">

<!-- <img src="docs/assets/voice-command.gif" alt="Voice Command Demo" width="100%" /> -->

**🎙️ Voice-Driven Design**
<br/>
<sub>Speak naturally — the AI agent builds geometry in real-time</sub>

</td>
<td align="center" width="50%">

<!-- <img src="docs/assets/gesture-nav.gif" alt="Gesture Navigation Demo" width="100%" /> -->

**🤚 Gesture Navigation**
<br/>
<sub>Orbit, pan, zoom — all from your webcam, no special hardware</sub>

</td>
</tr>
<tr>
<td align="center" width="50%">

<!-- <img src="docs/assets/constraint-extraction.gif" alt="Constraint Extraction" width="100%" /> -->

**📄 Spec Sheet Intelligence**
<br/>
<sub>Upload a PDF — constraints are extracted and enforced automatically</sub>

</td>
<td align="center" width="50%">

<!-- <img src="docs/assets/agent-chat.png" alt="Agent Chat Log" width="100%" /> -->

**🤖 Transparent AI Reasoning**
<br/>
<sub>Watch every tool call and decision in the live chat log</sub>

</td>
</tr>
</table>
</div>

---

## At a Glance

<div align="center">

| Stat | |
|:---|:---|
| **76** source files | across frontend & backend |
| **12** CAD tools | primitives, booleans, transforms, patterns |
| **7** AI agent tools | constraint queries, scene state, design review |
| **6** gesture types | orbit, pan, zoom, reset, select, push-to-talk |
| **Real-time SSE** | streaming agent responses & tool execution |
| **0** mouse clicks needed | to design a complete part |

</div>

---

## Features

### 🤖 AI Design Agent
Claude interprets voice commands and spec sheets to generate precise 3D geometry. It plans multi-step operations, chains boolean cuts, and respects engineering constraints — all streamed to you in real-time via the chat log.

### 🤚 Gesture Navigation
MediaPipe hand tracking turns your webcam into a 3D controller. A custom gesture state machine with EWMA smoothing and frame-level debouncing ensures fluid, jitter-free navigation.

### 📄 Constraint-Aware Design
Upload an engineering PDF and the system extracts dimensional, mounting, clearance, and material constraints using Claude's vision capabilities. The AI agent references these constraints while designing, and a built-in design review tool audits compliance.

### 🎙️ Voice Control
Hold push-to-talk (or raise your index finger) and describe what you want in plain English. Whisper transcribes, Claude reasons, and JSCAD builds — all in one seamless pipeline.

### 📦 Browser-Side CAD Engine
JSCAD runs entirely in a Web Worker — primitives, booleans (subtract, union, intersect), transforms, and patterns execute without blocking the UI. Geometry is converted to Three.js meshes in real-time.

### 💾 STL Export
One click to export your design as a production-ready STL file for 3D printing or CNC machining.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React + TypeScript + Vite                                       │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Three.js │  │ JSCAD    │  │ MediaPipe  │  │ Chat Sidebar │  │
│  │ Viewport │  │ Worker   │  │ Gestures   │  │ + Constraints│  │
│  └────┬─────┘  └────┬─────┘  └──────┬─────┘  └──────┬───────┘  │
│       │              │               │               │           │
│       └──────────────┴───────────────┴───────────────┘           │
│                              │                                    │
│                    SSE ↓  ↑ REST + tool-result POST              │
├──────────────────────────────────────────────────────────────────┤
│                         BACKEND                                   │
│  FastAPI + Python                                                 │
│                                                                   │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ Claude     │  │ Constraint  │  │ Whisper     │               │
│  │ Agent Loop │  │ Store +     │  │ Speech-to-  │               │
│  │ (SSE)      │  │ Extraction  │  │ Text        │               │
│  └────────────┘  └─────────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

**The hybrid pattern:** The backend orchestrates Claude's agent loop and manages session state. The frontend owns all geometry (JSCAD) and rendering (Three.js). During an agent turn, tool calls stream down via SSE, the frontend executes them in a Web Worker, and posts results back — forming a real-time bidirectional loop.

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | React 18 + TypeScript 5.9 + Vite 8 | UI framework & build |
| **3D Rendering** | Three.js 0.162 | WebGL viewport |
| **CAD Engine** | JSCAD 2.13 | Parametric geometry (Web Worker) |
| **Gestures** | MediaPipe Vision | Hand landmark detection |
| **UI** | Tailwind CSS + shadcn + Base UI | Styling & components |
| **Backend** | FastAPI + Uvicorn | Async API server |
| **AI Agent** | Claude (Anthropic API) | Design reasoning & tool use |
| **Speech** | Whisper (OpenAI API) | Voice transcription |
| **PDF Parsing** | OpenDataLoader | Constraint extraction |
| **Realtime** | SSE + eventsource-parser | Streaming communication |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **Java** 11+ (for OpenDataLoader PDF parsing)
- **API Keys:** [Anthropic](https://console.anthropic.com/) + [OpenAI](https://platform.openai.com/)

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/CADence.git
cd CADence

# Configure environment
cp backend/.env.example backend/.env
# Add your ANTHROPIC_API_KEY and OPENAI_API_KEY
```

### Run the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

### Run the Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Project Structure

```
CADence/
├── frontend/src/
│   ├── components/         # UI components (viewport, sidebar, toolbar)
│   ├── hooks/              # useSession, useJscad, useVoice, useGestures, useAgent, useConstraints
│   ├── lib/api/            # REST + SSE client layer
│   ├── lib/three/          # Scene, camera, materials
│   ├── lib/jscad/          # CAD engine, Web Worker, STL export
│   ├── lib/mediapipe/      # Hand tracking + gesture state machine
│   └── pages/              # Landing page
├── backend/app/
│   ├── services/           # Agent loop, scene state, constraints, extraction, Whisper
│   ├── routers/            # API endpoints (session, voice, spec, tools)
│   ├── models/             # Pydantic models (session, scene, constraints)
│   └── prompts/            # System, review, and extraction prompts
└── implementation-spec.md  # Full technical specification
```

---

## Team

Built in 36 hours at **MACHacks 2026** by:

| | Name | Role |
|:---|:---|:---|
| <!-- <img src="https://github.com/username.png" width="30" /> --> | **Hayat Ahmad** | <!-- your role --> |
| <!-- <img src="https://github.com/username.png" width="30" /> --> | **Robert Yin** | <!-- your role --> |
| <!-- <img src="https://github.com/RupertChin.png" width="30" /> --> | **Rupert Chin** | <!-- your role --> |

---

<div align="center">

**[⬆ Back to top](#-cadence)**

*Designed & engineered with caffeine and conviction*

</div>
