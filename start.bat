@echo off
echo ============================================
echo   RentFlow - Rental Management System
echo ============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if MySQL is running
echo Checking MySQL...
mysql -u root -pHanny-19@24456237LHF -e "SELECT 1" >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: MySQL might not be running!
    echo Please make sure MySQL is running before continuing.
    echo.
)

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)

REM Drop existing database and create fresh one
echo Setting up fresh database...
echo NOTE: This will delete all existing data!
set /p confirm="Type 'yes' to continue: "
if /i "%confirm%" neq "yes" (
    echo Setup cancelled.
    pause
    exit /b 0
)

mysql -u root -pHanny-19@24456237LHF < setup-empty.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to set up database!
    echo Make sure MySQL is running and credentials are correct.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Database is ready! Starting server...
echo ============================================
echo.
echo The application will open in your browser.
echo Press Ctrl+C to stop the server.
echo.

REM Start the server
node server.js

pause
