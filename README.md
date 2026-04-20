# Linus Partnerships – Availability Viewer

A web application that displays on which days **Emani Cheng, PMHNP** has scheduling availability at Well Life Medicine (Hillsboro, OR).

By default the next month's availability is shown; a toggle lets you switch to the current month.

## Architecture

```
Browser  ──▶  Express (Node.js)  ──▶  Athenahealth GraphQL API
                 │                       pss-function.scheduling.athena.io
                 │
             public/   (static HTML/CSS/JS)
```

Instead of using a headless browser, the backend calls the Athenahealth **consumer scheduling GraphQL API** directly:

1. **`createConsumerWorkflowToken`** – obtain a short-lived JWT (no credentials required; the same token the public SPA uses).
2. **`SearchAvailabilityDates`** – query available dates for a given month, practitioner, and visit type.

Availability is queried for **both** visit types (existing-patient and new-patient) and merged so the result reflects *any* open slot.

### Why direct API calls instead of Puppeteer?

| | Direct API | Headless Browser |
|---|---|---|
| **Speed** | ~1-2 s per request | ~10-20 s |
| **Docker image size** | ~60 MB (Alpine) | ~1.5 GB (Chromium) |
| **Reliability** | No DOM changes to break selectors | Fragile to UI updates |
| **Resource usage** | Minimal | Heavy (CPU + RAM) |

The trade-off is that if Athenahealth changes their GraphQL schema, the queries will need updating — but the same applies to CSS selectors in a scraping approach.

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
- **Frontend:** Vanilla HTML / CSS / JS (zero build step)
- **Container:** `node:22-alpine` (lightweight)
