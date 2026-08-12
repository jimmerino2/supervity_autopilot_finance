# 🚀 Gym Facilities Invoice Processor

## About

This was our submission for the Supervity Autopilot Hackathon 2026, in which we were assigned to the finance track. This project also won our team first place within our track, which marked the first win of our hackathon win. Special thanks to Tan-Li-Yang for developing the Supervity workflows alongside me.

Watch how it works here: https://youtu.be/xw3HirmHZ0s

(The project deployment ended as there are no more Supervity tokens post event)


## Description 

An AI-powered accounts payable command center built for multi-branch gym and fitness operators across Southeast Asia — including AnytimeFitness, Chi Fitness, and X Fitness — and the equipment distributors that supply them, such as DO!T.

Invoices arrive in three recurring shapes: large one-off **equipment** purchases, ongoing **maintenance** contracts, and recurring **subscription** billing. The system's orchestrators scan for incoming invoices, validate them against configurable AI policies (matched to PO, price, and branch), auto-approve what's safe, and route anything blocked — missing PO, price mismatch, unrecognized branch — to a human reviewer via a manual approval workbench with the specific issue called out. An AI Insights layer surfaces spend patterns across branches and vendors.

Under the hood: FastAPI + PostgreSQL backend, Next.js dashboard, Supabase for data/auth, and [Supervity](https://supervity.ai) for the underlying AI workflow orchestration.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Python 3.11 + FastAPI | API server |
| **Frontend** | Next.js 15 + React 19 | Web dashboard |
| **Database** | PostgreSQL 15 | Persistent storage |
| **ORM** | SQLAlchemy 2 + Alembic | Data modeling + migrations |
| **Auth** | NextAuth.js + JWT | Authentication (bypass-able) |
| **UI** | Tailwind CSS + Framer Motion | Styling + animations |
| **Containers** | Docker + Docker Compose | Development environment |
