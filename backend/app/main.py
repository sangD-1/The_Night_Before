from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routes import documents, retrieval, chat

app = FastAPI(
    title="The Night Before API",
    description="Backend API for The Night Before study assistant",
    version="0.4.0",
)

# Initialize SQLite database tables on application launch
@app.on_event("startup")
def on_startup():
    init_db()

# Allowed origins for local development
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(documents.router)
app.include_router(retrieval.router)
app.include_router(chat.router)

# Direct alias for /api/search
@app.post("/api/search")
def search_alias(request: retrieval.SearchRequest):
    return retrieval.search_materials(request)

@app.get("/api/health")
def get_health():
    """Health check endpoint to verify backend connectivity (preserved from Step 2)."""
    return {
        "status": "ok",
        "message": "The Night Before backend is running",
        "app": "The Night Before",
        "version": "0.3.0",
    }
