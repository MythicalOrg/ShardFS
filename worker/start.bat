@echo off
echo Starting ShardFS Worker Node...
echo.
echo Configuration:
echo - Port: 8000
echo - Master: http://localhost:9000
echo - Storage: ./chunks
echo.
npm run dev
pause
