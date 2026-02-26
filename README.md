# Mosaic📔

[简体中文](./README.zh.md) | English

> "Reintegrate the scattered fragments of oneself"

A digital second brain that combines note-taking with emotional visualization, helping you record thoughts, track moods, and integrate the scattered fragments of daily life.

---

## Origin

I realized that even though I have memorable moments every day, they gradually fade away over time. So I wanted to develop an app to organize my scattered life fragments, allowing me to recall the scenes and moods of those moments later. That's how Mosaic was born.

---

## Core Features

**Smart Note System**

- Rich text editor supporting Markdown and HTML for freer writing
- AI-powered automatic tag extraction for smarter categorization
- AI summary generation for quick review of key points in long texts

**Mood Diary**

- Daily mood recording to track emotional changes
- Visualized mood history to discover emotional patterns

**Cross-Platform Support**

- Desktop: Windows, macOS, Linux
- Mobile: iOS, Android
- Cloud data sync, access anywhere

> Due to developer device limitations, currently only Windows, Linux, and Android platforms are supported

---

## Directory Structure

```
Mosaic/
├── desktop/     # Tauri desktop application
├── mobile/      # Expo mobile application
├── server/      # Rust backend service
├── packages/    # Shared packages
│   ├── api/     # API type definitions
│   └── utils/   # Utility functions
└── docs/        # Documentation
```

## Technical Architecture

- Desktop: Tauri 2 + React 19 + TypeScript
- Mobile: Expo React Native
- Server: Rust + Actix Web + PostgreSQL
- AI Integration: Supports multiple AI service providers

---

## Getting Started

1. For data security, you first need to deploy your own Mosaic backend service on your own server to manage your private data
   1. `mkdir mosaic-server`
   2. `cd mosaic-server`
   3. Create a `.env` file in this folder, refer to [.env.example](./server/.env.example) for content, and modify the configuration items as needed (remember to change the username and password)
   4. Also create a `docker-compose.yml` file in this folder, simply copy [docker-compose.yml](./server/docker-compose.yml)
   5. Go back to the mosaic-server folder and run `docker-compose up -d` to start
   6. **Note**: If you encounter permission issues with file uploads, run `chown -R 1000:1000 ~/mosaic-server/storage ~/mosaic-server/logs` to fix directory permissions
   7. Afterwards, you can configure reverse proxy to your own domain
2. Download the client from releases and connect to your own server

---

## License

This project is open-sourced under the [AGPL-3.0 license](./LICENSE).
