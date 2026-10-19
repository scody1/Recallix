# RECALLIX — Turn Questions Into Mastery

**Recallix** is a high-performance, local-first personal examination preparation and question-practice platform. Engineered for multi-year competitive exam preparation (such as SSC CGL, CPO, and other standardized tests), Recallix transforms bulk PDF study materials and question banks into an interactive practice, spaced repetition, and preparation intelligence engine.

---

## 🎯 Purpose & Design Philosophy

Competitive examination candidates face thousands of questions distributed across massive PDF books and previous year papers. Traditional workflows rely on static PDF viewers, manual paper answer keys, and unstructured notebook error tracking.

**Recallix** eliminates these friction points by providing:
1. **Local-First & Completely Private**: Zero mandatory cloud accounts, zero telemetry, zero subscription lock-ins, and zero third-party AI dependencies. All question banks, attempt history, and revision logs remain on your local machine.
2. **Deterministic & Fast PDF Ingestion**: High-throughput extraction of questions, options, tabular data, mathematical notations, and separate answer keys from native and scanned PDFs using PyMuPDF and local image-preprocessing OCR pipelines.
3. **Cognitive Practice Modes**: Flexible untimed drills, timed test simulations, strict exam conditions with automated submission, and optional instant-review feedback with negative marking deduction.
4. **Spaced Repetition Mistake Tracking**: Automated Leitner/SM-2-inspired scheduling (+1d, +2d, +5d, +14d) with 1-click cognitive mistake classification (e.g., *Concept not clear*, *Calculation error*, *Silly mistake*, *Misread question*).
5. **Preparation Intelligence**: Longitudinal metrics distinguishing unique question coverage from raw attempt volume, pinpointing weak topics, and identifying speed bottlenecks.

---

## 🚀 Key Features

### 1. Ingestion Pipeline & PDF Import
- **High-Capacity Processing**: Handles multi-hundred and multi-thousand page documents in background worker threads without freezing the user interface.
- **Answer Key Extraction**: Automatically locates, parses, and binds answer keys (whether formatted at the end of the question or in a dedicated solution section at the back of the book).
- **Mathematical & Structural Support**: Preserves square roots ($\sqrt{x}$), stacked fractions, exponents, sub-scripts, markdown tables, and multi-page spanning questions.
- **Multilingual Support**: Built-in support for Hindi Devanagari option markers (`क, ख, ग, घ`), normalizing them to standard option formats.
- **Visual Page Snapshots**: Automatically renders and caches high-fidelity page images (`.png`) for side-by-side verification in the Question Library.
- **Integrity Safeguards**: Detects SHA-256 duplicate files and marks questions with missing answer keys as `incomplete` rather than silently fabricating answers.

### 2. Practice Arena
- **Pool Filtering**: Practice from the entire library, specific uploaded PDFs, unattempted questions, previously incorrect questions, or bookmarked items.
- **Subject & Topic Focus**: Filter by Quantitative Aptitude, Reasoning, English, or General Studies, or drill into specific topics.
- **Practice Modes**:
  - **Untimed Drill**: Unhurried practice session tracking per-question speed and elapsed time.
  - **Timed Practice**: Configurable countdown timer with pause, resume, and persistence across refreshes.
  - **Strict Simulation**: Authentic exam simulation with automatic submission upon timer expiry.
  - **Immediate Review Toggle**: Optional per-question verification displaying immediate correctness, explanations, and mark deductions.
- **Keyboard Navigation & Palette**: Quick question selection palette, review flagging, question bookmarking, and responsive desktop shortcuts.

### 3. Smart Revision & Spaced Repetition
- **Automated Ingestion of Errors**: Every incorrect answer is automatically routed to the Revision Centre.
- **Cognitive Mistake Classification**: 1-click tagging for mistakes:
  - *Concept not clear*
  - *Calculation error*
  - *Silly mistake*
  - *Misread question*
  - *Time pressure*
  - *Guessed answer*
- **Configurable Intervals**: Escalating spaced repetition intervals (+1 day for fresh errors, +2 days for uncertain answers, +5 days for correct responses, +14 days for consistently mastered items).

### 4. Preparation Intelligence & Analytics
- **Dashboard Overview**: Tracks total questions in library, unique questions attempted, unique coverage percentage, and active study time.
- **Subject & Topic Accuracy**: Granular breakdowns identifying lowest-accuracy subject areas and speed bottlenecks.
- **Mistake Distribution**: Visual categorization of why errors happen, helping candidates correct study habits.
- **Persistent Global Timer**: Accurate session timer supporting midnight transitions and multi-tab synchronization via BroadcastChannel.

### 5. Disaster Recovery & Local Data Integrity
- **SQLite WAL Mode**: Resilient concurrency with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and foreign key enforcement (`PRAGMA foreign_keys=ON`).
- **Zero-Downtime Backup & Restore**: Creates self-contained backup archives (`.zip`) containing full database snapshots and cryptographic SHA-256 manifests.
- **Complete Data Portability**: Export question libraries, attempt histories, and performance summaries to CSV and JSON at any time.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic |
| **Database** | SQLite 3 (WAL mode, Foreign Key constraints enabled) |
| **PDF & Vision** | PyMuPDF (fitz), Pillow, Tesseract OCR (optional local binary) |
| **Client Storage** | IndexedDB, LocalStorage, BroadcastChannel API |

---

## 📁 Project Architecture

```
recallix/
├── backend/                  # Python FastAPI Backend
│   ├── main.py               # REST API endpoints & background job workers
│   ├── database.py           # SQLite schema, WAL configuration, queries & backups
│   ├── extractor.py          # PyMuPDF parser, regex segmentation & OCR fallback
│   ├── classifier.py         # Heuristic subject & topic classification
│   ├── deduplicator.py       # SimHash / text normalization duplicate detection
│   └── test_*.py             # Automated test & verification suites
├── src/                      # React TypeScript Frontend
│   ├── components/           # Reusable UI components & layouts
│   │   ├── layout/           # Sidebar, Header, Global Stopwatch
│   │   └── ui/               # Cards, badges, buttons, modals, math renderers
│   ├── pages/                # Main application views
│   │   ├── Dashboard/        # Intelligence metrics & study goals
│   │   ├── QuestionLibrary/  # Question viewer, search, verification & filters
│   │   ├── PracticeArena/    # Practice configuration, session drill & results
│   │   ├── RevisionCentre/   # Spaced repetition queues & mistake classifier
│   │   ├── Analytics/        # Subject accuracy & time distribution
│   │   ├── ImportCentre/     # Multi-PDF upload & background ingestion logs
│   │   └── Settings/         # Online backup creation & restore management
│   ├── services/             # API client, storage & persistent timer engine
│   └── types/                # Strict TypeScript data models
├── data/                     # Local data directory (excluded from git)
│   ├── uploads/              # Uploaded PDF files
│   ├── assets/pages/         # Rendered page snapshots for verification
│   └── backups/              # Automated database snapshots
├── index.html                # Entry point
├── package.json              # Frontend manifest & scripts
├── requirements.txt          # Python core dependencies
├── tailwind.config.js        # Design tokens & dark mode styling
├── tsconfig.json             # TypeScript compiler settings
└── vite.config.ts            # Vite bundler configuration
```

---

## ⚙️ Installation & Setup

### Prerequisites
1. **Node.js** (v18 or higher)
2. **Python** (v3.10 or higher)
3. *(Optional)* **Tesseract OCR** on system PATH if processing scanned/image-only PDFs.

### 1. Clone the Repository
```bash
git clone https://github.com/scody1/Recallix.git
cd Recallix
```

### 2. Frontend Setup
```bash
npm install
```

### 3. Backend Setup
```bash
pip install -r requirements.txt
```

---

## 🏃 Running the Application

### Development Mode

1. **Start the Backend API Server**:
```bash
python -m uvicorn backend.main:app --port 8000 --host 127.0.0.1
```
The REST API will be available at `http://127.0.0.1:8000`.

2. **Start the Frontend Development Server**:
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Production Build
To create an optimized production build of the frontend:
```bash
npm run build
```
Compiled static assets are generated in the `dist/` directory.

---

## 📖 PDF Import & Practice Workflow

1. **Import PDFs**: Navigate to **Import Centre** and upload your PDF question papers. The background worker will extract questions, parse options, detect answer keys, and generate page preview snapshots.
2. **Verify Questions**: Open **Question Library** to inspect extracted stems, verify answers against side-by-side page snapshots, or mark incomplete questions.
3. **Practice**: Go to **Practice Arena**, choose your question pool (e.g. *Quantitative Aptitude* or *All Unattempted*), pick your mode (*Untimed*, *Timed*, or *Strict Simulation*), and start your session.
4. **Review Mistakes**: Navigate to **Revision Centre** to classify your errors and practise items scheduled by the spaced repetition algorithm.
5. **Backup Your Progress**: Visit **Settings** to create point-in-time database snapshots before major updates.

---

## 🧪 Verification & Test Suites

Recallix includes automated testing suites covering extraction fidelity, practice session lifecycle, analytics computations, and database safety:

```bash
# 1. 15-Step Comprehensive End-to-End Acceptance Suite
python -m backend.test_phase7_e2e

# 2. 25-Point System Audit & Regression Suite
python -m backend.test_final_audit

# 3. High-Volume Scale Benchmark (2,500 Questions & 100-Q Drills)
python -m backend.test_isolated_scale_and_sessions

# 4. Multi-Page, Hindi Devanagari & Math Extraction Benchmark
python -m backend.test_extraction_stress
```

---

## 📄 License

This project is licensed under the MIT License.
