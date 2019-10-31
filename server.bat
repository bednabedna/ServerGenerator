@echo off

IF [%1]==[] (
	ECHO   Usage: %0 ^<config.xml^>
) ELSE (
	nodemon --watch %~dp1 --ignore generated-routes/** --ext xml,sql %~dp0/index.js %1
)
:: nodemon -exec "%~dp0/appGenerator/index.js %1 > %~dp0/generated-apps/index.js" --watch %~dp1 --ignore generated-routes/** --ext xml,sql