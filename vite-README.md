# PacketScope Frontend

## Tech Stack

- **React** — UI framework
- **TypeScript** — Type-safe JavaScript
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Utility-first CSS framework

## Development

```bash
# Install dependencies
npm install

# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Docker

The frontend is built and served via Docker Compose:

```bash
docker compose up app
```

Production build runs on port 4173.

## Project Structure

```
src/
├── components/     # React components
├── pages/          # Page-level components
├── assets/         # Static assets
├── App.tsx         # Root component
└── main.tsx        # Entry point
```

## API Integration

The frontend connects to backend services:

| Service | Port | Endpoint |
|---------|------|----------|
| Monitor API | 8010 | `/GetRecentPacket`, `/QuerySockList`, etc. |
| Calculator API | 8020 | WebSocket |
| Tracer API | 8000 | `/api/trace`, `/api/analyze`, etc. |
| Guarder API | 8080 | `/api/connections`, `/api/filters`, etc. |
