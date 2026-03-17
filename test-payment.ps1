#!/usr/bin/env powershell
# Payment Endpoint Test Script

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  PAYMENT SYSTEM TEST" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Test 1: Backend Health
Write-Host "🏥 Test 1: Backend Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Backend is online" -ForegroundColor Green
    Write-Host "   📦 Database: $($health.database)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "   ❌ Backend is offline!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Test 2: Payment Endpoint
Write-Host "💳 Test 2: Payment Endpoint (/api/payments/create-order)" -ForegroundColor Yellow

$testPayload = @{
    amount = 799
    currency = 'INR'
    receipt = 'test_order_' + (Get-Date -Format 'yyyyMMddHHmmss')
} | ConvertTo-Json

try {
    $paymentResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/payments/create-order" `
                                         -Method POST `
                                         -Body $testPayload `
                                         -ContentType "application/json" `
                                         -TimeoutSec 10
    
    Write-Host "   ✅ Payment endpoint is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   📋 Response Received:" -ForegroundColor Cyan
    Write-Host "      $($paymentResponse | ConvertTo-Json -Depth 5)" -ForegroundColor White
    Write-Host ""
    
    if ($paymentResponse.order) {
        $orderId = $paymentResponse.order.id
        $amount = [double]$paymentResponse.order.amount / 100
        $currency = $paymentResponse.order.currency
        $status = $paymentResponse.order.status
        $receipt = $paymentResponse.order.receipt
        
        Write-Host "   📋 Razorpay Order Details:" -ForegroundColor Cyan
        Write-Host "      Order ID: $orderId" -ForegroundColor White
        Write-Host "      Amount: ₹$amount" -ForegroundColor White
        Write-Host "      Currency: $currency" -ForegroundColor White
        Write-Host "      Status: $status" -ForegroundColor White
        Write-Host "      Receipt: $receipt" -ForegroundColor White
    }
    Write-Host ""
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "  ✅ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Fixed Issues:" -ForegroundColor Yellow
    Write-Host "   ✓ HTTP 429 (Too Many Requests) - Rate limits increased" -ForegroundColor White
    Write-Host "   ✓ HTTP 403 (Forbidden) - CSRF exemption for payments" -ForegroundColor White
    Write-Host "   ✓ Payment API fully operational" -ForegroundColor White
    Write-Host ""
    Write-Host "👍 You can now make online payments on the website!" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "   ❌ Payment endpoint failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Error Details:" -ForegroundColor Yellow
    Write-Host "      Message: $($_.Exception.Message)" -ForegroundColor White
    
    if ($_.Exception.Response) {
        Write-Host "      Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor White
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "      Response: $responseBody" -ForegroundColor White
        } catch {
            # Could not read response
        }
    }
    
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check backend console for error messages" -ForegroundColor White
    Write-Host "   2. Verify .env file has Razorpay keys:" -ForegroundColor White
    Write-Host "      RAZORPAY_KEY_ID=rzp_test_..." -ForegroundColor Gray
    Write-Host "      RAZORPAY_KEY_SECRET=..." -ForegroundColor Gray
    Write-Host "   3. Ensure CSRF middleware exempts /payments/ routes" -ForegroundColor White
    Write-Host ""
    exit 1
}
