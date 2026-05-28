@echo off
:: UMX Space Hardware System - Database Backup & Restore Tool
:: [ Secure Relational Isolation & Double-Confirmation Safety Grid ]

:: Force UTF-8 terminal code page to prevent garbled Chinese characters on Windows
chcp 65001 >nul

set "BACKUP_DIR=C:\supabase_backups"

:MENU
cls
echo ============================================================
echo          UMX 数据库安全灾备管理工具 (DB TOOL)
echo          [ Secure Storage ^& Zero-Loss Disaster Recovery ]
echo ============================================================
echo.
echo  备份存储目录: %BACKUP_DIR%
echo.
echo  [1] 一键全量备份数据库 (Backup)
echo  [2] 一键还原历史备份 (Restore - 需二次安全确认)
echo  [3] 打开备份文件夹
echo  [4] 退出工具
echo.
echo ============================================================
set /p choice="请输入操作编号 [1-4]: "

if "%choice%"=="1" goto BACKUP
if "%choice%"=="2" goto RESTORE
if "%choice%"=="3" goto OPEN_DIR
if "%choice%"=="4" goto EXIT
goto MENU

:BACKUP
cls
echo ============================================================
echo                【数据库全量安全备份程序】
echo ============================================================
echo.
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: 获取时间戳 (格式: YYYYMMDD_HHMMSS)
set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "BACKUP_FILE=%BACKUP_DIR%\supabase_backup_%TIMESTAMP%.sql"

echo [1/2] 正在检索 Docker 数据库容器状态...
docker ps --filter "name=supabase-postgres" --format "{{.Names}}" | findstr "supabase-postgres" >nul
if errorlevel 1 (
    echo.
    echo ❌ [ERROR] 未检测到正在运行的 supabase-postgres 容器！
    echo 请先运行 deploy.bat 启动系统服务。
    echo.
    pause
    goto MENU
)

echo [2/2] 正在导出全量数据到物理介质...
:: 注意：重定向输入输出时使用 docker exec -i (不带 -t，防止 TTY 字符污染备份文件)
docker exec -i supabase-postgres pg_dumpall -c -U postgres > "%BACKUP_FILE%"

if errorlevel 0 (
    echo.
    echo  ✨ [SUCCESS] 数据库全量安全备份成功！
    echo  备份路径: %BACKUP_FILE%
    echo.
    
    :: 自动清理 30 天前的旧备份，防止磁盘撑爆
    forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path" 2>nul
) else (
    echo.
    echo  ❌ [ERROR] 备份失败，请检查 Docker 容器运行状态或磁盘空间！
    echo.
)
pause
goto MENU

:RESTORE
cls
echo ============================================================
echo            【数据库高危还原程序 - 数据覆盖警告】
echo ============================================================
echo.
echo  ⚠️  警告：
echo  1. 还原数据库会【彻底覆盖】当前生产环境的所有数据！
echo  2. 覆盖后，未备份的最新数据将【永远丢失，无法找回】！
echo.
echo ============================================================
echo  当前已检测到的历史备份文件列表：
echo ------------------------------------------------------------
if not exist "%BACKUP_DIR%" (
    echo  ❌ 未找到备份文件夹或没有任何备份文件。
    echo.
    pause
    goto MENU
)

dir "%BACKUP_DIR%\*.sql" /B /O:-D
echo ------------------------------------------------------------
echo.
set /p restore_file="请输入您要还原的文件完整名称 (例如 supabase_backup_20260528_153020.sql): "

if "%restore_file%"=="" (
    echo ❌ 输入不能为空！已取消操作。
    pause
    goto MENU
)

set "FULL_PATH=%BACKUP_DIR%\%restore_file%"
if not exist "%FULL_PATH%" (
    echo.
    echo ❌ [ERROR] 找不到指定的备份文件: %FULL_PATH%
    echo 请仔细核对文件名是否拼写正确（需带 .sql 后缀）。
    echo.
    pause
    goto MENU
)

cls
echo ============================================================
echo            【❗❗❗ 数据库还原二次安全确认 ❗❗❗】
echo ============================================================
echo.
echo  准备还原的文件: %restore_file%
echo  目标生产数据库: supabase-postgres
echo.
echo  此操作是【毁灭性且不可逆的】！
echo  如果您确认要用该备份覆盖当前所有的线上数据，
echo  请输入大写的【YES】进行最终确认，输入其他内容将直接安全中止。
echo.
echo ============================================================
set /p confirm="请输入 YES 进行最终确认: "

if not "%confirm%"=="YES" (
    echo.
    echo 🛡️ [SAFE] 二次确认未通过，已安全取消数据库还原操作。
    echo.
    pause
    goto MENU
)

cls
echo ============================================================
echo               正在执行数据库物理还原，请稍候...
echo ============================================================
echo.

:: 1. 再次确认容器运行状态
docker ps --filter "name=supabase-postgres" --format "{{.Names}}" | findstr "supabase-postgres" >nul
if errorlevel 1 (
    echo ❌ [ERROR] 数据库容器未启动，还原中止！
    pause
    goto MENU
)

:: 2. 灌入备份 SQL 文件执行还原
docker exec -i supabase-postgres psql -U postgres -d postgres < "%FULL_PATH%"

if errorlevel 0 (
    echo.
    echo  🎉 [SUCCESS] 数据库已成功还原到指定版本！
    echo  还原版本: %restore_file%
    echo  请立即登录 Supabase Studio 或前端验证系统功能。
    echo.
) else (
    echo.
    echo  ❌ [ERROR] 还原过程中发生异常，请检查 SQL 备份文件的完整性！
    echo.
)
pause
goto MENU

:OPEN_DIR
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
explorer "%BACKUP_DIR%"
goto MENU

:EXIT
cls
echo ============================================================
echo  感谢使用 UMX 数据库灾备管理工具，祝您的生产系统稳定运行！
echo ============================================================
timeout /t 3 >nul
exit /b 0
