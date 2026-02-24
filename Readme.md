# Tenis Club Management App - Club Belgrano 🎾

A comprehensive, modern management system designed for **Club Belgrano** (General Belgrano, BS. AS.) to streamline tennis court bookings, membership management, and automated financial tracking.

## 🌟 Features

### 🎨 Premium UI/UX
- **Pastel Design System**: Vibrant yet soft aesthetic using brand blue/white and "polvo de ladrillo" clay-orange accents.
- **Dashboard Layout**: Card-based interface providing immediate visibility into account status, debt, and court availability.
- **Glassmorphism & Micro-animations**: Modern visual effects for a premium feels.

### 📅 Booking System
- **Interactive Calendar**: 90-minute slot selection grid for the club's 5 clay courts.
- **Multi-step Booking Form**:
    - Select Match Type (Single/Double).
    - Manage Players: Add members or invite guests.
    - Real-time cost validation.

### 💼 Admin & Finance
- **Admin Dashboard**: Specialized view for club managers to approve or reject pending requests.
- **Automated "Cuenta Corriente"**:
    - Proportional cost splitting between players.
    - Automatic debt generation upon booking confirmation.
    - Support for different membership tiers (Abono Libre, Abono x Partidos, No Socio).

## 🛠 Tech Stack

- **Monorepo**: NPM Workspaces.
- **Frontend**: Vite + React + TypeScript + Vanilla CSS + Lucide Icons.
- **Backend**: NestJS + TypeScript.
- **Database**: Supabase (PostgreSQL) with UUID/Gist extensions.
- **Auth**: Supabase Auth with custom RBAC profiles.

## 📂 Project Structure

```text
tenis/
├── backend/            # NestJS API
│   ├── src/
│   │   ├── bookings/   # Booking logic & debt engine
│   │   ├── supabase/   # Client integration
│   │   └── main.ts     # Entry point
├── frontend/           # Vite + React UI
│   ├── src/
│   │   ├── components/ # Reusable UI pieces (Calendar, Form)
│   │   ├── pages/      # Main views (Reserve, Admin)
│   │   ├── types/      # Shared TS interfaces
│   │   └── index.css   # Global Pastel Design System
├── docs/               # Requirements and analysis
└── .agent/             # AI development context & workflows
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Account & Project

### Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   - Create a project in Supabase.
   - Run the initial migrations (found in implementation plans) to create tables, triggers, and extensions.

3. **Environment Configuration**:
   - Create `.env` files in both `backend/` and `frontend/` with your Supabase URL and Key.

4. **Run Development Mode**:
   - **Backend**: `cd backend && npm run start:dev`
   - **Frontend**: `cd frontend && npm run dev`

## 📄 Documentation

For detailed implementation details, check the brain artifacts:
- [Implementation Plan](file:///C:/Users/far/.gemini/antigravity/brain/d6601a99-9b9f-4aab-98c9-d9c3dea42805/implementation_plan.md)
- [Walkthrough](file:///C:/Users/far/.gemini/antigravity/brain/d6601a99-9b9f-4aab-98c9-d9c3dea42805/walkthrough.md)
- [Task List](file:///C:/Users/far/.gemini/antigravity/brain/d6601a99-9b9f-4aab-98c9-d9c3dea42805/task.md)
