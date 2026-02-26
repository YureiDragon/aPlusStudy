# CompTIA A+ Study App

A fully offline, single-page study application for the **CompTIA A+ 220-1201 (Core 1)** and **220-1202 (Core 2)** certification exams (v4.0).

All content is pre-generated and embedded at build time — no API calls, no accounts, no internet required after loading. Installable as a PWA for offline access.

## Features

- **Dashboard** — Exam readiness scores (weighted by domain percentages), study streaks, weak area identification
- **Objective Browser** — All 63 exam objectives organized by domain with study notes
- **Flashcard Review** — 452 atomic flashcards with SM-2 spaced repetition scheduling and keyboard shortcuts
- **Practice Quizzes** — 638 questions (multiple-choice + matching) filterable by exam, domain, objective, and mastery level
- **Practice Exam** — Timed 90-minute simulated exams with 90 questions, weighted scoring out of 900, and exam history tracking
- **Glossary & Acronym Driller** — 327 terms with search, filters, progress tracking, mastery indicators, and quiz count control
- **Study Notes** — Detailed notes for every objective with exam tips and memory aids
- **Onboarding** — Diagnostic quiz for new users to identify strengths and seed initial progress
- **PWA Support** — Installable on mobile/desktop for full offline use

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- React Router v7
- Vitest (29 tests)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # preview production build
```

## Data

All study content is static JSON generated from the official CompTIA A+ exam objective PDFs:

| Content | Count |
|---------|-------|
| Exam Objectives | 63 (27 Core 1 + 36 Core 2) |
| Flashcards | 452 (216 Core 1 + 236 Core 2) |
| Practice Questions | 638 (296 Core 1 + 342 Core 2) |
| Glossary Terms | 327 |

## Exam Info

| | Core 1 (220-1201) | Core 2 (220-1202) |
|---|---|---|
| **Domains** | 5 | 4 |
| **Questions** | Up to 90 | Up to 90 |
| **Time** | 90 minutes | 90 minutes |
| **Passing** | 675 / 900 | 700 / 900 |

## Project Structure

```
src/
  components/       # React UI components
  data/             # Static JSON (objectives, flashcards, questions, glossary)
  hooks/            # Custom React hooks (PWA install prompt)
  types/            # TypeScript interfaces
  utils/            # Spaced repetition, scoring, storage, colors
    __tests__/      # Unit tests
```

## License

This project is for personal educational use. CompTIA A+ is a registered trademark of CompTIA, Inc.
