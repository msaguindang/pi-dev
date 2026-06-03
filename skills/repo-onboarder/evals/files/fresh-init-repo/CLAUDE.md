# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What This Is

NTV API V2 — .NET 8 Web API backend for the NTV digital signage platform. Replaces api-v1 (.NET 2.2). Handles device registration, playlist/schedule management, asset distribution, and reporting. Deployed via Docker to EC2.

## Commands

```bash
# Run locally
dotnet run --project src/NtvApi

# Run tests
dotnet test

# Build Docker image
docker build -t ntv-api-v2 .

# Publish to EC2 (via deploy script)
./scripts/deploy.sh staging
```

## Architecture

- `src/NtvApi/` — main Web API project
- `src/NtvApi/Controllers/` — REST controllers (Devices, Playlists, Schedules, Assets, Reports)
- `src/NtvApi/Services/` — business logic layer
- `src/NtvApi/Data/` — EF Core DbContext + migrations (PostgreSQL)
- `src/NtvApi/Models/` — domain models and DTOs
- `tests/NtvApi.Tests/` — xUnit integration tests

## Code Standards

- Use conventional commits: feat, fix, chore, docs, refactor
- Always use `async/await` — no `.Result` or `.Wait()`
- Return `IActionResult` or `ActionResult<T>` from controllers
- No raw SQL — use EF Core LINQ only
- All endpoints require JWT auth unless decorated with `[AllowAnonymous]`
- PascalCase for classes/methods, camelCase for variables
- Use `var` only when type is obvious from right-hand side
- Write clean, maintainable code with clear intent

## CI/CD

GitHub Actions on push to `main` and `staging` branches:
1. Run tests
2. Build Docker image
3. Push to ECR
4. Deploy to EC2 via SSM
