@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias, aguarde...
  call npm install
)

if not exist "web\dist" (
  echo Preparando o sistema pela primeira vez, aguarde...
  call npm run build
)

start "" http://localhost:4173
call npm start
