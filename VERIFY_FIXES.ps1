Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "COMPREHENSIVE FIX VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results = @()

# Check 1: Environment Variable
Write-Host "Checking VITE_API_URL in .env..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
if ($envContent -match "VITE_API_URL=http://localhost:5000/api") {
    Write-Host "   PASS: VITE_API_URL correctly set" -ForegroundColor Green
    $results += "PASS: API URL"
} else {
    Write-Host "   FAIL: VITE_API_URL not set correctly" -ForegroundColor Red
    $results += "FAIL: API URL"
}

# Check 2: Browser History in App.tsx
Write-Host "`nChecking browser history implementation..." -ForegroundColor Yellow
$appContent = Get-Content src/App.tsx -Raw
if ($appContent -match "window\.history\.pushState" -and $appContent -match "handlePopState") {
    Write-Host "   PASS: Browser history support added" -ForegroundColor Green
    $results += "PASS: Browser History"
} else {
    Write-Host "   FAIL: Browser history not implemented" -ForegroundColor Red
    $results += "FAIL: Browser History"
}

# Check 3: Variant API Routes
Write-Host "`nChecking variant API routes..." -ForegroundColor Yellow
$apiContent = Get-Content src/services/api.ts -Raw
if ($apiContent -match "/variants/auto-generate" -and $apiContent -match "/variants/single") {
    Write-Host "   PASS: Variant API routes correct" -ForegroundColor Green
    $results += "PASS: Variant Routes"
} else {
    Write-Host "   FAIL: Variant API routes need fixing" -ForegroundColor Red
    $results += "FAIL: Variant Routes"
}

# Check 4: Stock Route
Write-Host "`nChecking stock routes in backend..." -ForegroundColor Yellow
$stockRoutesContent = Get-Content server/routes/stock.routes.js -Raw
if ($stockRoutesContent -match "check-availability") {
    Write-Host "   PASS: Stock check route exists" -ForegroundColor Green
    $results += "PASS: Stock Routes"
} else {
    Write-Host "   FAIL: Stock check route missing" -ForegroundColor Red
    $results += "FAIL: Stock Routes"
}

# Check 5: Product Routes
Write-Host "`nChecking product variant routes in backend..." -ForegroundColor Yellow
$productRoutesContent = Get-Content server/routes/product.routes.js -Raw
if ($productRoutesContent -match "/variants/auto-generate" -and $productRoutesContent -match "/variants/single") {
    Write-Host "   PASS: Product variant routes exist" -ForegroundColor Green
    $results += "PASS: Product Routes"
} else {
    Write-Host "   FAIL: Product variant routes missing" -ForegroundColor Red
    $results += "FAIL: Product Routes"
}

# Check 6: onViewProduct prop
Write-Host "`nChecking onViewProduct prop in OrdersPage..." -ForegroundColor Yellow
if ($appContent -match "OrdersPage.*onViewProduct=\{handleViewProduct\}") {
    Write-Host "   PASS: onViewProduct prop passed correctly" -ForegroundColor Green
    $results += "PASS: View Product Prop"
} else {
    Write-Host "   FAIL: onViewProduct prop not passed" -ForegroundColor Red
    $results += "FAIL: View Product Prop"
}

# Check 7: Refund Columns SQL Script
Write-Host "`nChecking refund columns SQL script..." -ForegroundColor Yellow
if (Test-Path "server/database/ADD_REFUND_COLUMNS.sql") {
    Write-Host "   PASS: SQL migration script exists" -ForegroundColor Green
    Write-Host "   WARNING: Remember to execute this in Supabase!" -ForegroundColor Yellow
    $results += "WARNING: SQL Migration (needs execution)"
} else {
    Write-Host "   FAIL: SQL migration script missing" -ForegroundColor Red
    $results += "FAIL: SQL Migration"
}

# Check 8: Backend Server Running
Write-Host "`nChecking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 3
    if ($response.status -eq "success") {
        Write-Host "   PASS: Backend server running" -ForegroundColor Green
        Write-Host "   Database: $($response.database)" -ForegroundColor White
        $results += "PASS: Backend Running"
    }
} catch {
    Write-Host "   FAIL: Backend server not responding" -ForegroundColor Red
    $results += "FAIL: Backend Not Running"
}

# Check 9: Frontend Server Running
Write-Host "`nChecking if frontend is running..." -ForegroundColor Yellow
try {
    $webReq = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 3
    Write-Host "   PASS: Frontend server running (HTTP $($webReq.StatusCode))" -ForegroundColor Green
    $results += "PASS: Frontend Running"
} catch {
    Write-Host "   FAIL: Frontend server not responding" -ForegroundColor Red
    $results += "FAIL: Frontend Not Running"
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passed = ($results | Where-Object { $_ -like "PASS*" }).Count
$warning = ($results | Where-Object { $_ -like "WARNING*" }).Count
$failed = ($results | Where-Object { $_ -like "FAIL*" }).Count
$total = $results.Count

Write-Host "Total Checks: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Warnings: $warning" -ForegroundColor Yellow
Write-Host "Failed: $failed" -ForegroundColor Red

Write-Host "`nDetailed Results:" -ForegroundColor White
$results | ForEach-Object { Write-Host "  $_" }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "NEXT ACTIONS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "1. Execute SQL migration in Supabase:" -ForegroundColor Yellow
Write-Host "   - Go to: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "   - SQL Editor -> Run: server/database/ADD_REFUND_COLUMNS.sql`n" -ForegroundColor White

Write-Host "2. Restart servers to apply .env changes:" -ForegroundColor Yellow
Write-Host "   - Stop both servers (Ctrl+C)" -ForegroundColor White
Write-Host "   - Run: npm run dev (frontend)" -ForegroundColor White
Write-Host "   - Run: cd server; npm start (backend)`n" -ForegroundColor White

Write-Host "3. Test critical flows:" -ForegroundColor Yellow
Write-Host "   - Product detail -> Stock check" -ForegroundColor White
Write-Host "   - Checkout -> Payment -> Order creation" -ForegroundColor White
Write-Host "   - Admin -> Product variants -> Auto-generate" -ForegroundColor White
Write-Host "   - Orders page -> Click product image" -ForegroundColor White
Write-Host "   - Exchange request -> Variant selection" -ForegroundColor White
Write-Host "   - Admin -> Approve refund`n" -ForegroundColor White

Write-Host "========================================`n" -ForegroundColor Cyan
