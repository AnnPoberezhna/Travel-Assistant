# Travel Assistant

This project is a web-based application designed to provide users with an intuitive and efficient way to search for transport connections. It supports both traditional text input and modern voice-activated search, enabling flexible and accessible interaction. The system integrates with external data providers to retrieve and present real-time information on available routes, schedules, and travel options.

## Features

- **Voice Input**: Search for routes using voice commands with Web Speech API
- **Smart Route Search**: Find direct and connecting routes between stops
- **Favorite Routes**: Save frequently used routes for quick access
- **Search History**: Track your previous searches
- **User Authentication**: Secure sign-up/sign-in with NextAuth.js
- **Admin Dashboard**: User management and system administration

## Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Authentication**: NextAuth.js v4
- **Password Hashing**: bcrypt

### Database
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Models**: User, Przystanek (Stop), Przewoznik (Carrier), Polaczenie (Connection), Trasa (Route), SearchHistory, FavoriteRoutes

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v20 or higher)
- npm/yarn/pnpm
- PostgreSQL database
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AnnPoberezhna/Travel-Assistant.git
cd Travel-Assistant
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/travel_assistant"

# NextAuth
NEXTAUTH_URL="http://localhost:####"
NEXTAUTH_SECRET="your-secret-key-here"
# Generate with: openssl rand -base64 32
```

### 4. Database Setup

Run Prisma migrations to set up your database schema:

```bash
npx prisma migrate dev
```

Seed the database (optional):

```bash
npx prisma db seed
```

### 4b. Import Real Transportation Data 🚀

You have 2 options to populate the database:

#### Option 1: Real GTFS Data from Warsaw (RECOMMENDED ⭐)

Import **real transportation data** from ZTM Warsaw open data:

```bash
npm run import:gtfs
```

**What you get:**
- ✅ 500 real stops from Warsaw
- ✅ 1 real operator (ZTM Warszawa)
- ✅ 100 real bus/tram/metro lines
- ✅ 50 trips with actual schedules
- ✅ Free and updated daily

**Data source:** https://mkuran.pl/gtfs/warsaw.zip (94MB)

**Note:** Import takes ~3 minutes. The script automatically limits data to keep database manageable.

#### Option 2: Realistic Generated Data (Fallback)

If GTFS import fails or you want faster setup:

```bash
npm run import:gtfs:fallback
```

**What you get:**
- 19 stops (Wrocław, Kraków, Warszawa, Poznań, Gdańsk, Katowice, Opole)
- 7 operators (PKP InterCity, FlixBus, MPK, etc.)
- 12 connections with realistic schedules
- Instant import (~1 second)

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost](http://localhost) in your browser.

## Project Structure

```
├── app/
│   ├── (auth)/              # Authentication pages
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/         # Protected dashboard pages
│   │   ├── admin/           # Admin panel
│   │   ├── favorites/       # Saved favorite routes
│   │   ├── history/         # Search history
│   │   └── search/          # Route search
│   ├── api/                 # API routes
│   │   ├── auth/            # NextAuth endpoints
│   │   ├── routeSearch/     # Route search logic
│   │   ├── favoriteRoutes/  # Favorites management
│   │   └── searchHistory/   # History tracking
│   ├── components/          # Reusable components
│   │   ├── form/            # Form components
│   │   ├── ui/              # UI primitives
│   │   ├── Navbar.tsx
│   │   ├── VoiceInput.tsx
│   │   └── ...
│   └── lib/                 # Utility functions
│       ├── auth.ts          # Auth configuration
│       ├── db.ts            # Prisma client
│       └── ...
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── seed.js              # Database seeding
│   └── migrations/          # Migration history
└── public/                  # Static assets
```

## Database Schema

### Key Models

- **User**: User accounts with authentication
- **Przystanek**: Transportation stops/stations
- **Przewoznik**: Transport carriers/operators
- **Polaczenie**: Connections/lines operated by carriers
- **Trasa**: Routes with stops and schedules
- **SearchHistory**: User search tracking
- **FavoriteRoutes**: Saved favorite routes

### User Roles
- `USER`: Standard user with search and favorites
- `ADMIN`: Administrative access to manage users

## Authentication

The app uses NextAuth.js with credential-based authentication:

- Sign up with email, username, and password
- Passwords are hashed with bcrypt
- JWT-based sessions
- Protected routes for authenticated users
- Role-based access control (User/Admin)

## API Endpoints

### Public Routes
- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration

### Protected Routes
- `GET /api/routeSearch/find` - Search for routes
- `POST /api/routeSearch/parse` - Parse search query
- `GET /api/favoriteRoutes` - Get user favorites
- `POST /api/favoriteRoutes` - Save favorite route
- `DELETE /api/favoriteRoutes` - Remove favorite
- `GET /api/searchHistory` - Get search history

### Admin Routes
- `GET /api/admin/users` - List all users
- `GET /api/admin/me` - Get current admin info

## Development

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Build for Production

```bash
npm run build
npm run start
```

## License

This project is licensed under the MIT License

## Authors

- **AnnPoberezhna** - [GitHub Profile](https://github.com/AnnPoberezhna)
- **Franiu78** - [GitHub Profile](https://github.com/Franiu78)


## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Database ORM by [Prisma](https://www.prisma.io/)
- Authentication by [NextAuth.js](https://next-auth.js.org/)
