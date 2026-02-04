# Unit Tests - Spotify Insights

Esta carpeta contiene todos los tests unitarios del proyecto Spotify Insights.

## Estructura

```
__tests__/
├── lib/
│   ├── spotify/
│   │   ├── oauth.test.ts          # Tests para OAuth (state generation, URL building)
│   │   └── getValidToken.test.ts  # Tests para token validation y refresh
│   └── insights/
│       ├── insights.repository.test.ts  # Tests para queries SQL (stats, tracks, activity)
│       └── insights.service.test.ts     # Tests para agregación de datos
└── api/
    └── routes.test.ts              # Tests para API routes (placeholder)
```

## Servicios Testeados

### 1. **Spotify OAuth** (`lib/spotify/oauth.test.ts`)
- ✅ Generación de state aleatorio
- ✅ Construcción de URL de autorización
- ✅ Validación de scopes

### 2. **Spotify Token Validation** (`lib/spotify/getValidToken.test.ts`)
- ✅ Retorna token válido sin expirar
- ✅ Refresca token expirado
- ✅ Elimina token si refresh falla
- ✅ Lanza error si no hay token

### 3. **Insights Repository** (`lib/insights/insights.repository.test.ts`)
- ✅ Obtiene estadísticas totales
- ✅ Obtiene top 10 tracks
- ✅ Obtiene actividad diaria (90 días)
- ✅ Maneja datos vacíos correctamente

### 4. **Insights Service** (`lib/insights/insights.service.test.ts`)
- ✅ Agrega datos de repositorio
- ✅ Ejecuta queries en paralelo
- ✅ Retorna DTO con estructura correcta

## Cómo Ejecutar

### Todos los tests
```bash
pnpm test
```

### Tests en modo watch (recargan automáticamente)
```bash
pnpm test:watch
```

### Tests con cobertura
```bash
pnpm test:coverage
```

### Tests de un archivo específico
```bash
pnpm test oauth.test.ts
pnpm test getValidToken.test.ts
```

## Coverage Goals

- `lib/spotify/`: 100% (OAuth y token handling son críticos)
- `lib/insights/`: 90%+ (lógica de datos)
- `app/api/auth/`: En desarrollo (require mocking de Route Handlers)

## Herramientas Utilizadas

- **Jest**: Framework de testing
- **ts-jest**: Soporte para TypeScript en Jest
- **jest-mock-extended**: Mocks avanzados para Prisma
- **@testing-library/jest-dom**: Utilidades para testing DOM

## Notas Importantes

1. **Mocks de Prisma**: Todos los tests usan mocks de `prisma` para evitar llamadas reales a BD
2. **Parallelización**: Los tests se ejecutan en paralelo para mayor velocidad
3. **Snapshots**: No se usan snapshots en estos tests (facilita mantenimiento)
4. **Cobertura**: Usa `npm run test:coverage` para ver qué código no está cubierto

## Próximos Tests a Implementar

- [ ] Tests de API routes con mocking de NextRequest/NextResponse
- [ ] Tests de componentes React (UserMenu, InsightsOverview)
- [ ] Tests de integración (flujos completos de OAuth)
- [ ] Tests E2E con Playwright o Cypress

## Variables de Entorno para Tests

Los tests usan las variables de entorno definidas en `.env.local`:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `APP_URL`
- `DATABASE_URL` (no se usa en tests, pero requerida por Prisma)

## Debugging

Para debuggear un test específico:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand __tests__/lib/spotify/oauth.test.ts
```

Luego abre `chrome://inspect` en Chrome.
