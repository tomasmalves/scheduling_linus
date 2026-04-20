# Linus Partnerships – Availability Viewer

A web application that displays on which days **Emani Cheng, PMHNP** has scheduling availability at Well Life Medicine.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

## Docker

```bash
docker build -t emani-availability .
docker run -p 3000:3000 emani-availability
# Open http://localhost:3000
```

## Tech Stack

- **Backend:** Node.js 22, Express 5
- **Frontend:** HTML / CSS / JS
- **Container:** `node:22-alpine` (lightweight)
