# 🛍️ Sirius E-Commerce API

A comprehensive, production-ready e-commerce backend built with **Fastify**, **TypeScript**, and **SQL Server**.

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: SQL Server
- **ORM**: Prisma
- **Caching**: Redis
- **Documentation**: Swagger/OpenAPI 3.0


## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd sirius-e-commerce
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory

### 4. Start dependencies with Docker

```bash
docker-compose up -d
```

This will start:
- SQL Server on port 1433
- Redis on port 6379

### 5. Run database migrations

```bash
npx prisma migrate dev
```

### 6. Start the development server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 📖 API Documentation

Interactive Swagger documentation is available at:

```
http://localhost:3000/docs
```


## 🔧 Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm run prisma:studio # Open Prisma Studio (database GUI)
```

## 🐳 Docker Support

Use Docker Compose for local development:

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f
```
