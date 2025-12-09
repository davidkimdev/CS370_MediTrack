# CS370 MediTrack

## Project Goal
This project is a Progressive Web App designed to help the Emory Farmworker Project manage their mobile clinic's medication inventory. The primary goal is to provide a reliable, offline-first tool to replace their current paper-based system.

## Key Features
* **Real-Time Inventory Tracking:** Provides an up-to-date view of the medication formulary.
* **Electronic Dispensing Logs:** Allows for accurate, digital logging of dispensed medications.
* **Offline-First Functionality:** Core features are designed to work seamlessly in environments with poor or no internet connection.

## How to Run This Project Locally
1.  **Clone the repository:** `git clone https://github.com/NateHu203/CS370_MediTrack.git`
2.  **Install dependencies:** `npm install`
3.  **Run the development server:** `npm run dev`
4.  Open your browser to `http://localhost:5173`

## Technology Stack
* **Frontend:** React, TypeScript, Vite
* **Database:** Supabase (PostgreSQL)
* **Styling:** Tailwind CSS
* **Offline:** Custom service worker implementation with IndexedDB

## Deployment Guide
For complete step-by-step instructions on deploying this application to production (Vercel + Supabase), please see the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## User Manual
Please check the following documentation resource for guidances to navigate the system:
* [MediTrack - User Manual](./MediTrack%20-%20User%20Manual.pdf)
