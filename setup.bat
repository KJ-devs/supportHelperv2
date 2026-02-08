@echo off
REM Support Helper - Quick Setup Script for Windows

echo.
echo ========================================
echo Support Helper Platform - Setup
echo ========================================
echo.

REM Check for Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo X Node.js not found. Please install Node.js 20+
    pause
    exit /b 1
)

REM Check for pnpm
where pnpm >nul 2>nul
if errorlevel 1 (
    echo. Installing pnpm...
    npm install -g pnpm
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo O Node.js %NODE_VERSION%

for /f "tokens=*" %%i in ('pnpm --version') do set PNPM_VERSION=%%i
echo O pnpm %PNPM_VERSION%
echo.

echo Installing dependencies...
call pnpm install
echo O Dependencies installed
echo.

REM Copy env file
if not exist .env.local (
    echo Creating .env.local from .env.example...
    copy .env.example .env.local
    echo O .env.local created (edit with your settings)
) else (
    echo O .env.local already exists
)
echo.

REM Start Docker
echo Starting Docker containers...
where docker >nul 2>nul
if errorlevel 1 (
    echo X Docker not found. Install Docker or manually start services
) else (
    docker-compose up -d 2>nul
    if errorlevel 1 (
        docker compose up -d
    )
    echo O Waiting for services...
    timeout /t 5 /nobreak
)
echo.

echo Setting up database...
call pnpm db:migrate
echo O Migrations applied
echo.

call pnpm db:seed
echo O Database seeded
echo.

echo Building packages...
call pnpm build
echo O Packages built
echo.

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo Next steps:
echo 1. Review .env.local settings
echo 2. Start development: pnpm dev
echo 3. Open dashboard: http://localhost:3000
echo 4. View API docs: http://localhost:3001/api/docs
echo.
echo Documentation:
echo - README.md - Quick start guide
echo - ARCHITECTURE.md - System design
echo.
pause
