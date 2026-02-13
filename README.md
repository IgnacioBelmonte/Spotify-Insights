
Structure 

spotify-insights/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  └─ callback/route.ts
│  ├─ (dashboard)/
│  │  ├─ page.tsx
│  │  ├─ listening/page.tsx
│  │  ├─ artists/page.tsx
│  │  ├─ tracks/page.tsx
│  │  └─ settings/page.tsx
│  ├─ api/
│  │  ├─ sync/route.ts
│  │  └─ me/route.ts
│  ├─ layout.tsx
│  └─ page.tsx
│
├─ src/
│  ├─ lib/
│  │  ├─ env.ts
│  │  ├─ spotify/
│  │  │  ├─ client.ts
│  │  │  ├─ oauth.ts
│  │  │  ├─ mappers.ts
│  │  │  └─ types.ts
│  │  ├─ db/
│  │  │  ├─ prisma.ts
│  │  │  └─ queries.ts
│  │  └─ analytics/
│  │     ├─ aggregates.ts
│  │     └─ scoring.ts
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ charts/
│  │  └─ layout/
│  └─ domain/
│     ├─ user/
│     ├─ listening/
│     └─ insights/
│
├─ prisma/
│  └─ schema.prisma
├─ public/
└─ docker-compose.yml

## Build on Raspberry Pi (arm64)

See `docs/raspberry-pi-build.md` for build-stability guidance and Pi-specific build command.
