# Admin Dashboard API Test Script
Write-Host "`n═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   ADMIN DASHBOARD COMPREHENSIVE TEST" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════`n" -ForegroundColor Cyan

# Wait for backend to be ready
Start-Sleep -Seconds 2

try {
    # Login
    $loginBody = @{
        email = "admin@shringarika.test"
        password = "Admin@123456"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    Write-Host "✅ LOGIN SUCCESSFUL" -ForegroundColor Green
    Write-Host "   User: $($loginResponse.user.name)" -ForegroundColor White
    Write-Host "   Email: $($loginResponse.user.email)" -ForegroundColor White
    Write-Host "   Role: $($loginResponse.user.role)" -ForegroundColor White
    Write-Host ""

    $token = $loginResponse.token
    $headers = @{
        Authorization = "Bearer $token"
    }

    # Test 1: Orders endpoint
    Write-Host "1️⃣ Testing /api/admin/orders..." -ForegroundColor Cyan
    $ordersResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/orders" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "   ✅ Status: SUCCESS" -ForegroundColor Green
    Write-Host "   📦 Orders: $($ordersResponse.data.orders.Count)" -ForegroundColor White
    Write-Host "   📄 Total: $($ordersResponse.data.pagination.total)" -ForegroundColor White
    Write-Host ""

    # Test 2: Users endpoint (THE FIX WE APPLIED)
    Write-Host "2️⃣ Testing /api/admin/users..." -ForegroundColor Cyan
    $usersResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "   ✅ Status: SUCCESS" -ForegroundColor Green
    Write-Host "   👥 Users: $($usersResponse.data.users.Count)" -ForegroundColor White
    Write-Host "   📄 Total: $($usersResponse.data.pagination.total)" -ForegroundColor White
    Write-Host ""

    # Test 3: Dashboard endpoint
    Write-Host "3️⃣ Testing /api/admin/dashboard..." -ForegroundColor Cyan
    $dashResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/dashboard" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "   ✅ Status: SUCCESS" -ForegroundColor Green
    Write-Host "   💰 Total Revenue: ₹$($dashResponse.data.metrics.totalRevenue)" -ForegroundColor White
    Write-Host "   📦 Total Orders: $($dashResponse.data.metrics.totalOrders)" -ForegroundColor White
    Write-Host "   👥 Total Users: $($dashResponse.data.metrics.totalUsers)" -ForegroundColor White
    Write-Host "   📈 This Month Revenue: ₹$($dashResponse.data.metrics.thisMonthRevenue)" -ForegroundColor White
    Write-Host ""

    # Summary
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
    Write-Host "   ✅ ALL 3 ENDPOINTS WORKING!" -ForegroundColor Green
    Write-Host "   ✅ NO 401 OR 500 ERRORS!" -ForegroundColor Green
    Write-Host "   ✅ ADMIN DASHBOARD IS FUNCTIONAL!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════`n" -ForegroundColor Green

    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Open browser at: http://localhost:3000" -ForegroundColor White
    Write-Host "2. Login with: admin@shringarika.test / Admin@123456" -ForegroundColor White
    Write-Host "3. Navigate to Admin Dashboard" -ForegroundColor White
    Write-Host "4. Verify all pages load without 401 errors`n" -ForegroundColor White

} catch {
    Write-Host "`n❌ TEST FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nMake sure the backend server is running on port 5000" -ForegroundColor Yellow
    exit 1
}
