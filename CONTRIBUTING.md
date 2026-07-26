# Contributing

## Dev setup

See [README.md](README.md#setup) for backend/frontend setup instructions.

## Before committing

```bash
# Backend
cd backend
black .
ruff check --fix .
pytest

# Frontend
cd frontend
npx prettier --write "src/**/*.{js,jsx,css}"
npm run lint
npm run build
```

## Code style

- Backend: [Black](https://black.readthedocs.io/) formatting, [Ruff](https://docs.astral.sh/ruff/)
  for linting/import ordering. Config lives in `backend/pyproject.toml`.
- Frontend: [Prettier](https://prettier.io/) formatting, ESLint for linting. Config lives in
  `frontend/.prettierrc` and `frontend/.eslintrc.cjs`.
- New backend logic that doesn't require live GEE credentials (normalization, classification,
  caching, etc.) should get a test in `backend/tests/`.

## Methodology changes

If you change how an index is calculated (SPI, SPEI, CDI, etc.), update
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) in the same change — that file is the single
source of truth for what's ICPAC/WMO-standard vs. a project-specific simplification.
