# DocuMind -- AI Document Intelligence Platform

```{=html}
<p align="center">
```
`<strong>`{=html}Upload documents. Ask questions. Get answers grounded
in your files.`</strong>`{=html}
```{=html}
</p>
```
```{=html}
<p align="center">
```
`<a href="https://documind-912o.onrender.com">`{=html}Live
Demo`</a>`{=html}
```{=html}
</p>
```
## Overview

**DocuMind** is an AI-powered document intelligence platform that lets
users upload documents and interact with their content through a
conversational interface. It uses Retrieval-Augmented Generation (RAG)
to retrieve relevant document content and generate answers grounded in
uploaded files.

The application uses separate frontend, backend, and AI services, with
Supabase PostgreSQL and pgvector for persistent data storage and vector
search.

## Live Application

-   **Frontend:** https://documind-912o.onrender.com
-   **Backend health check:**
    https://documind-api-7scj.onrender.com/health
-   **AI service health check:**
    https://documind-ai-yxgn.onrender.com/health

> Render free services may sleep after inactivity, so the first request
> can take longer while a service wakes up.

## Features

-   User registration and login with password hashing and JWT
    authentication.
-   PDF, DOCX, and TXT document uploads.
-   Document text extraction, chunking, and embedding generation.
-   Semantic retrieval using PostgreSQL and pgvector.
-   AI-powered document question answering using Google Gemini.
-   Answers grounded in uploaded document content, with source
    information where available.
-   Per-document conversations and chat history.
-   Document switching and new chat sessions.
-   Delete uploaded documents and associated application data.
-   Dashboard with document information and processing status.

## Technology Stack

  Layer                 Technologies
  --------------------- ---------------------------------------
  Frontend              React, Vite, Tailwind CSS
  Backend API           Node.js, Express
  Authentication        JWT, bcryptjs
  AI service            Python, FastAPI
  Document processing   PyMuPDF and text extraction utilities
  Generative AI         Google Gemini API
  Embeddings            `gemini-embedding-001`
  Database              Supabase PostgreSQL
  Vector search         pgvector
  Deployment            Render

## System Architecture

``` text
User / Browser
      |
      v
React + Vite Frontend (Render)
      |
      v
Node.js + Express Backend (Render)
      |                         |
      | database operations     | document processing / chat
      v                         v
Supabase PostgreSQL       Python + FastAPI AI Service (Render)
+ pgvector                       |
                                 v
                         Google Gemini API
```

## How Document Q&A Works

1.  The user signs in and uploads a PDF, DOCX, or TXT file.
2.  The backend validates the upload and stores document metadata.
3.  The backend forwards the file to the AI service.
4.  The AI service extracts text and splits it into chunks.
5.  The service generates embeddings and stores chunks in PostgreSQL
    using pgvector.
6.  When the user asks a question, relevant chunks are retrieved using
    vector similarity search.
7.  Gemini generates an answer using the retrieved document context.
8.  The application displays the answer and available source information
    in the chat.

## Repository Structure

``` text
DocuMind/
├── frontend/       # React + Vite user interface
├── backend/        # Express API, authentication and document routes
├── ai-service/     # FastAPI document processing and RAG service
├── database/       # PostgreSQL schema
└── docs/           # Project documentation
```

## Run Locally

### Prerequisites

-   Node.js and npm
-   Python 3
-   PostgreSQL with the pgvector extension
-   A Google Gemini API key

### 1. Clone the repository

``` bash
git clone https://github.com/PrasadYanpallewar/DocuMind.git
cd DocuMind
```

### 2. Configure environment variables

Create local environment files using the relevant `.env.example` files
as a guide. Configure the database connection, JWT secret, Gemini API
key, and service URLs required by each service.

**Never commit real `.env` files, database passwords, JWT secrets, or
API keys.**

### 3. Set up the database

Create a PostgreSQL database with pgvector available, then execute:

``` text
database/schema.sql
```

### 4. Start the backend

``` bash
cd backend
npm install
npm start
```

### 5. Start the AI service

``` bash
cd ai-service
python -m venv venv
```

Windows PowerShell:

``` powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Start the frontend

In a separate terminal:

``` bash
cd frontend
npm install
npm run dev
```

Set the frontend API base URL and backend-to-AI service URL in the
appropriate local environment files before starting the services.

## Database

The PostgreSQL schema includes these core tables:

-   `users` -- user account information and password hashes.
-   `documents` -- uploaded document metadata and processing status.
-   `document_chunks` -- extracted text chunks and vector embeddings.
-   `conversations` -- chat sessions associated with users and
    documents.
-   `messages` -- conversation messages and available source data.

The current schema stores 768-dimensional embeddings generated with
`gemini-embedding-001`.

## Security Notes

-   Passwords are stored as hashes, not plain text.
-   Protected API routes use JWT authentication.
-   Document access is checked against the authenticated user.
-   Backend upload validation and file-size limits are applied.
-   Keep secrets in environment variables and rotate any credential that
    may have been exposed.
-   Review and enable an appropriate Row Level Security (RLS) policy
    strategy before allowing direct client-side access to protected
    database data. The application should access protected data through
    its authenticated backend.

## Current Deployment

The public application is deployed on Render, with Supabase providing
the hosted PostgreSQL database. The frontend, backend API, and AI
service are deployed separately.

## Future Improvements

-   Email OTP verification and password reset.
-   Dedicated login activity/history.
-   More detailed analytics and usage reporting.
-   Document-processing retry and monitoring tools.
-   Expanded document organization and collection workflows.

## Author

**Prasad Yanpallewar**

GitHub: [PrasadYanpallewar](https://github.com/PrasadYanpallewar)

------------------------------------------------------------------------

Explore the live demo and repository to learn more about DocuMind.
