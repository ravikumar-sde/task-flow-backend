# Trello Backend - Clean Architecture

A Node.js backend application built with Express.js and MongoDB, following Clean Architecture principles.

## ✨ Features

- 🏗️ **Clean Architecture** - Separation of concerns with clear boundaries
- 🔐 **Authentication** - Local (email/password) and OAuth (Google, GitHub)
- 🔑 **JWT Tokens** - Secure token-based authentication with refresh tokens
- ✅ **Validation** - Input validation using express-validator
- 🛡️ **Security** - Password hashing with bcrypt, secure token management
- 📝 **Well-documented** - Comprehensive API documentation

## 🏗️ Architecture Overview

This project follows Clean Architecture principles, separating concerns into distinct layers:

```
src/
├── config/           # Configuration files (database, server)
├── entities/         # Business entities (core business logic)
├── use-cases/        # Application business rules
├── controllers/      # Presentation layer (HTTP handlers)
├── routes/           # API route definitions
├── middlewares/      # Express middlewares
├── database/         # Database layer
│   └── models/       # Mongoose models
└── utils/            # Utility functions
```

### Layer Responsibilities

1. **Entities** (`src/entities/`)
   - Core business logic
   - Framework-independent
   - Contains business rules and validations

2. **Use Cases** (`src/use-cases/`)
   - Application-specific business rules
   - Orchestrates data flow between entities and database
   - Contains the application's business logic

3. **Controllers** (`src/controllers/`)
   - Handles HTTP requests and responses
   - Delegates business logic to use cases
   - Transforms data for presentation

4. **Routes** (`src/routes/`)
   - Defines API endpoints
   - Maps URLs to controller methods

5. **Database Models** (`src/database/models/`)
   - Database schema definitions
   - Data persistence layer
   - Mongoose models

6. **Middlewares** (`src/middlewares/`)
   - Request/response processing
   - Authentication, logging, validation, etc.

7. **Utils** (`src/utils/`)
   - Helper functions
   - Common utilities

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB (local or cloud instance)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/trello_db
   ```

### Running the Application

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 📡 API Endpoints

### Health Check
- `GET /health` - Check server status

### Authentication
- `POST /api/v1/auth/signup` - Register new user (local)
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user (requires auth)
- `GET /api/v1/auth/me` - Get current user (requires auth)
- `PUT /api/v1/auth/profile` - Update profile (requires auth)
- `GET /api/v1/auth/google` - Login with Google
- `GET /api/v1/auth/github` - Login with GitHub

### Users
- `POST /api/v1/users` - Create a new user
- `GET /api/v1/users` - Get all users
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

📖 **For detailed authentication documentation, see [AUTHENTICATION.md](./AUTHENTICATION.md)**

## 🧪 Example Requests

### Sign Up
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Current User (Protected Route)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/auth/me
```

## 📝 Project Structure Details

- **Clean Architecture**: Separation of concerns with clear boundaries
- **Dependency Rule**: Dependencies point inward (outer layers depend on inner layers)
- **Framework Independence**: Business logic is independent of Express.js
- **Testability**: Easy to test each layer independently

## 🔧 Technologies Used

### Core
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB

### Authentication
- **Passport.js** - Authentication middleware
- **passport-google-oauth20** - Google OAuth strategy
- **passport-github2** - GitHub OAuth strategy
- **jsonwebtoken** - JWT token generation and verification
- **bcryptjs** - Password hashing

### Validation & Security
- **express-validator** - Request validation
- **cors** - CORS middleware

### Development
- **dotenv** - Environment variable management
- **nodemon** - Development auto-reload

## 📚 Adding New Features

To add a new feature (e.g., "Board"):

1. Create entity: `src/entities/Board.js`
2. Create model: `src/database/models/BoardModel.js`
3. Create use case: `src/use-cases/board.usecase.js`
4. Create controller: `src/controllers/board.controller.js`
5. Create routes: `src/routes/board.routes.js`
6. Register routes in `src/app.js`

## 📄 License

ISC

