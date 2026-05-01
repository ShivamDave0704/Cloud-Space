@echo off
setlocal enabledelayedexpansion

cls
echo ============================================
echo   Cloud Storage App - Quick Setup
echo ============================================
echo.

REM -------------------------------
REM Email Configuration
REM -------------------------------
:email_user
set /p EMAIL_USER="Enter Email (Gmail): "
if "!EMAIL_USER!"=="" (
    echo ❌ Email cannot be empty!
    goto email_user
)

:email_pass
set /p EMAIL_PASS="Enter Email App Password: "
if "!EMAIL_PASS!"=="" (
    echo ❌ Cannot be empty!
    goto email_pass
)

REM -------------------------------
REM MongoDB
REM -------------------------------
:mongo
set /p MONGO_URI="Enter MongoDB URI: "
if "!MONGO_URI!"=="" (
    echo ❌ Cannot be empty!
    goto mongo
)

REM -------------------------------
REM Admin Setup
REM -------------------------------
:super_admin_pass
set /p SUPER_ADMIN_PASSWORD="Enter Super Admin Password: "
if "!SUPER_ADMIN_PASSWORD!"=="" (
    echo ❌ Cannot be empty!
    goto super_admin_pass
)

:admin_pass
set /p ADMIN_PASSWORD="Enter Admin Password: "
if "!ADMIN_PASSWORD!"=="" (
    echo ❌ Cannot be empty!
    goto admin_pass
)

:admin_pin
set /p ADMIN_PRIVACY_PIN="Enter Admin Privacy PIN: "
if "!ADMIN_PRIVACY_PIN!"=="" (
    echo ❌ Cannot be empty!
    goto admin_pin
)

REM -------------------------------
REM Payment
REM -------------------------------
:upi_id
set /p UPI_ID="Enter UPI ID: "
if "!UPI_ID!"=="" (
    echo ❌ Cannot be empty!
    goto upi_id
)

:upi_name
set /p UPI_NAME="Enter UPI Name: "
if "!UPI_NAME!"=="" (
    echo ❌ Cannot be empty!
    goto upi_name
)

REM -------------------------------
REM Security
REM -------------------------------
:jwt
set /p JWT_SECRET="Enter JWT Secret: "
if "!JWT_SECRET!"=="" (
    echo ❌ Cannot be empty!
    goto jwt
)

REM -------------------------------
REM Optional (TeraBox)
REM -------------------------------
set /p TERABOX_EMAIL="Enter TeraBox Email (optional): "
set /p TERABOX_PASSWORD="Enter TeraBox Password (optional): "

REM -------------------------------
REM Create .env file
REM -------------------------------
(
echo # OAuth Configuration
echo GOOGLE_CLIENT_ID=
echo GOOGLE_CLIENT_SECRET=
echo GOOGLE_REDIRECT_URI=
echo GOOGLE_API_KEY=
echo.
echo FB_APP_ID=
echo FB_APP_SECRET=
echo.
echo TWITTER_KEY=
echo TWITTER_SECRET=
echo.
echo # Database
echo MONGO_URI=!MONGO_URI!
echo.
echo # Email Configuration
echo EMAIL_USER=!EMAIL_USER!
echo EMAIL_PASS=!EMAIL_PASS!
echo.
echo # Server Configuration
echo PORT=5000
echo BASE_URL=http://localhost:5000
echo ENABLE_NGROK=true
echo NGROK_AUTHTOKEN=
echo FILES_META=./filesMeta.json
echo.
echo # Admin Credentials
echo SUPER_ADMIN_EMAIL=admin@cloudspace.com
echo SUPER_ADMIN_PASSWORD=!SUPER_ADMIN_PASSWORD!
echo ADMIN_EMAIL=admin@cloudspace.com
echo ADMIN_PASSWORD=!ADMIN_PASSWORD!
echo.
echo # Admin Privacy PIN
echo ADMIN_PRIVACY_PIN=!ADMIN_PRIVACY_PIN!
echo.
echo # Coupon Configuration
echo COUPON_CODE=GET50
echo DISCOUNT_PERCENT=50
echo UPI_ID=!UPI_ID!
echo UPI_NAME=!UPI_NAME!
echo PRICE_PER_TB=450
echo.
echo # Cloud Coins
echo COINS_DISCOUNT_ENABLED=true
echo COINS_PER_RUPEE=5
echo.
echo # Security
echo JWT_SECRET=!JWT_SECRET!
echo.
echo # Storage
echo SYNC_FOLDER=./uploads
echo.
echo # TeraBox
echo TERABOX_EMAIL=!TERABOX_EMAIL!
echo TERABOX_PASSWORD=!TERABOX_PASSWORD!
echo.
echo # Auto Plans
echo AUTO_GENERATE_PLANS=true

) > .env

echo.
echo ✅ .env file created successfully!
echo Location: %cd%\.env
echo.

pause
endlocal