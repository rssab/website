# Resonant Systems Website

DML speaker company website built with Haxe + Bun + HTMX.

## Stack

- **Haxe** — Compiles to JavaScript
- **Bun** — Runtime
- **HTMX** — Dynamic partial loading without heavy JS frameworks

## Development

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Build
haxe build.hxml

# Run
bun run bin/server.js
```

Server runs on `http://localhost:8080`

## Structure

```
src/Server.hx          # Main server code
templates/
├── partials/          # Layout, nav, footer, etc.
└── pages/             # Page content
content/               # Markdown drafts (for reference)
docs/                  # Research & source material
```

## Deployment

Target: resonantsystems.eu (Hetzner)

---

Resonant Systems Sweden AB  
Kvarngatan 5, 64635 Gnesta, Sweden  
https://resonantsystems.eu
