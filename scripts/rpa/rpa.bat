@echo off
chcp 65001 >nul 2>&1
:: WeChat RPA Service CLI - Global command wrapper
:: Usage: rpa start | stop | status | logs | restart
python "%~dp0rpa_cli.py" %*
