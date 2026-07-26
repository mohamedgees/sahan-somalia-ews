@echo off
setlocal
echo ===========================================
echo   Somalia Drought EWS - System Startup
echo ===========================================

echo.
echo [1/2] Setting up and updating dependencies...

REM Backend
echo.
echo --- Backend (Python FastAPI) ---
cd backend
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing/Updating backend requirements...
pip install -r requirements.txt
cd ..

REM Frontend
echo.
echo --- Frontend (React + Vite) ---
cd frontend
echo Installing/Updating frontend dependencies...
call npm install
cd ..

echo.
echo [2/2] Launching services...

REM Start Backend
echo Starting Backend on port 8000...
start "Backend Server" cmd /k "cd backend && call venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

REM Start Frontend
echo Starting Frontend...
start "Frontend Server" cmd /k "cd frontend && call npm run dev"

echo.
echo System is running!
echo Access the application at: http://localhost:5173
echo.
pause
