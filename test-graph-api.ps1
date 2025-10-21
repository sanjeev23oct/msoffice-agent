# Test Graph API Diagnostic Endpoint
Write-Host "Testing Microsoft Graph API connection..." -ForegroundColor Cyan

# Step 1: Initialize agent
Write-Host "`nStep 1: Initializing agent..." -ForegroundColor Yellow
try {
    $initResponse = Invoke-RestMethod -Uri "http://localhost:3001/agent/initialize" -Method Post -ContentType "application/json"
    Write-Host "Agent initialized: $($initResponse.success)" -ForegroundColor Green
} catch {
    Write-Host "Failed to initialize agent: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 2: Start agent
Write-Host "`nStep 2: Starting agent..." -ForegroundColor Yellow
try {
    $startResponse = Invoke-RestMethod -Uri "http://localhost:3001/agent/start" -Method Post -ContentType "application/json"
    Write-Host "Agent started: $($startResponse.success)" -ForegroundColor Green
} catch {
    Write-Host "Failed to start agent: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Test Graph API
Write-Host "`nStep 3: Testing Graph API..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/test-graph" -Method Get
    
    Write-Host "`n=== USER PROFILE ===" -ForegroundColor Green
    Write-Host "Display Name: $($response.userProfile.displayName)"
    Write-Host "Email: $($response.userProfile.mail)"
    Write-Host "User Principal Name: $($response.userProfile.userPrincipalName)"
    Write-Host "User ID: $($response.userProfile.id)"
    
    Write-Host "`n=== MAILBOX SETTINGS ===" -ForegroundColor Green
    $response.mailboxSettings | ConvertTo-Json -Depth 5
    
    Write-Host "`n=== MESSAGES TEST ===" -ForegroundColor Green
    $response.messages | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host "`nERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "`nError Details:" -ForegroundColor Yellow
        $_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5
    }
}
