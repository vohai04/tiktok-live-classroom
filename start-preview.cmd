@echo off
cd /d "%~dp0"
set "CLASSROOM_PREVIEW=1"
set "PORT=3002"
call npm.cmd start
pause
