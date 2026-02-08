#!/bin/bash

# Support Helper - Quick Setup Script
set -e

echo "🚀 Support Helper Platform - Setup"
echo "===================================="
echo ""

# Check prerequisites
echo "✓ Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Please install Node.js 20+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "✗ pnpm not found. Installing..."
    npm install -g pnpm
fi

echo "✓ Node.js $(node --version)"
echo "✓ pnpm $(pnpm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install
echo "✓ Dependencies installed"
echo ""

# Copy env file
if [ ! -f .env.local ]; then
    echo "⚙️  Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "✓ .env.local created (edit with your settings)"
else
    echo "✓ .env.local already exists"
fi
echo ""

# Start Docker containers
echo "🐳 Starting Docker containers..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
elif command -v docker &> /dev/null; then
    docker compose up -d
else
    echo "⚠️  Docker not found. Install Docker or manually start:"
    echo "   docker-compose up -d"
fi
echo "✓ Waiting for services to be ready..."
sleep 5
echo ""

# Database setup
echo "🗄️  Setting up database..."
pnpm db:migrate
echo "✓ Migrations applied"
echo ""

pnpm db:seed
echo "✓ Database seeded with test data"
echo ""

# Build packages
echo "🔨 Building packages..."
pnpm build
echo "✓ Packages built"
echo ""

echo "✨ Setup complete!"
echo ""
echo "📌 Next steps:"
echo "   1. Review .env.local settings"
echo "   2. Start development: pnpm dev"
echo "   3. Open dashboard: http://localhost:3000"
echo "   4. View API docs: http://localhost:3001/api/docs"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Quick start guide"
echo "   - ARCHITECTURE.md - System design"
echo ""
