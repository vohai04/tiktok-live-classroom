@echo off
set "classroomEdge=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%classroomEdge%" set "classroomEdge=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
start "" "%classroomEdge%" --user-data-dir="%~dp0data\game-browser" --no-first-run --no-default-browser-check --app=http://localhost:3000/?obs=1 --window-size=570,1000 --autoplay-policy=no-user-gesture-required
