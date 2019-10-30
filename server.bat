@echo off

IF [%1]==[] (
	ECHO   Usage: %0 ^<config.xml^>
) ELSE (
	nodemon --watch %~dp1 --ignore generated-routes/** --ext xml,sql %~dp0index.js %1
)
