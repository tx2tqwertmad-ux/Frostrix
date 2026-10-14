@echo off
chcp 65001 >nul
title Сайт сервера
echo ================================
echo   Сайт сервера - запуск...
echo   Адрес: http://localhost:8080/
echo   Не закрывай это окно, пока пользуешься сайтом.
echo ================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
