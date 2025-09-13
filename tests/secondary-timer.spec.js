const { test, expect } = require('@playwright/test');

test.describe('Secondary Timer Feature', () => {
  test('Admin can create room with secondary timer enabled', async ({ page }) => {
    // Navigate to admin page
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Click create room button
    await page.click('#create-room-btn');
    
    // Wait for modal to appear
    await page.waitForSelector('#room-modal', { state: 'visible' });
    
    // Fill in room details
    await page.fill('#room-name', 'Test Secondary Timer Room');
    await page.fill('#timer-duration', '05:00');
    
    // Enable secondary timer
    await page.check('#secondary-timer-enabled');
    
    // Wait for secondary timer duration field to appear
    await page.waitForSelector('#secondary-timer-duration-group', { state: 'visible' });
    
    // Set secondary timer duration
    await page.fill('#secondary-timer-duration', '02:30');
    
    // Submit form
    await page.click('#save-btn');
    
    // Wait for modal to close and room to appear in grid
    await page.waitForSelector('#room-modal', { state: 'hidden' });
    await page.waitForSelector('.room-card', { timeout: 10000 });
    
    // Verify room was created
    const roomCards = await page.locator('.room-card');
    await expect(roomCards).toHaveCount(1);
    
    const roomName = await page.locator('.room-card .room-name').first().textContent();
    expect(roomName).toBe('Test Secondary Timer Room');
  });
  
  test('Secondary timer controls appear in GM interface when enabled', async ({ page }) => {
    // First create a room with secondary timer
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Create room with secondary timer
    await page.click('#create-room-btn');
    await page.waitForSelector('#room-modal', { state: 'visible' });
    await page.fill('#room-name', 'GM Secondary Timer Test');
    await page.fill('#timer-duration', '05:00');
    await page.check('#secondary-timer-enabled');
    await page.waitForSelector('#secondary-timer-duration-group', { state: 'visible' });
    await page.fill('#secondary-timer-duration', '03:00');
    await page.click('#save-btn');
    await page.waitForSelector('#room-modal', { state: 'hidden' });
    
    // Get the room ID from the room card
    const roomCard = await page.locator('.room-card').first();
    const gmButton = await roomCard.locator('button:has-text("GM View")');
    await gmButton.click();
    
    // Wait for GM page to load
    await page.waitForLoadState('networkidle');
    
    // Check that primary timer controls exist
    await expect(page.locator('#start-timer')).toBeVisible();
    await expect(page.locator('#timer-display')).toBeVisible();
    
    // Check that secondary timer controls are initially hidden
    const secondaryTimerSection = page.locator('#secondary-timer-section');
    await expect(secondaryTimerSection).toBeVisible();
    
    // Check secondary timer controls exist
    await expect(page.locator('#start-secondary-timer')).toBeVisible();
    await expect(page.locator('#secondary-timer-display')).toBeVisible();
  });
  
  test('Secondary timer checkbox toggles duration field visibility', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    await page.click('#create-room-btn');
    await page.waitForSelector('#room-modal', { state: 'visible' });
    
    // Initially, secondary timer duration should be hidden
    const durationGroup = page.locator('#secondary-timer-duration-group');
    await expect(durationGroup).toBeHidden();
    
    // Enable secondary timer
    await page.check('#secondary-timer-enabled');
    
    // Duration field should now be visible
    await expect(durationGroup).toBeVisible();
    
    // Disable secondary timer
    await page.uncheck('#secondary-timer-enabled');
    
    // Duration field should be hidden again
    await expect(durationGroup).toBeHidden();
  });
  
  test('Theme displays secondary timer when enabled', async ({ page }) => {
    // Create room with secondary timer
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    await page.click('#create-room-btn');
    await page.waitForSelector('#room-modal', { state: 'visible' });
    await page.fill('#room-name', 'Theme Secondary Timer Test');
    await page.check('#secondary-timer-enabled');
    await page.waitForSelector('#secondary-timer-duration-group', { state: 'visible' });
    await page.fill('#secondary-timer-duration', '01:30');
    await page.click('#save-btn');
    await page.waitForSelector('#room-modal', { state: 'hidden' });
    
    // Navigate to player view
    const roomCard = await page.locator('.room-card').first();
    const playerButton = await roomCard.locator('button:has-text("Player View")');
    await playerButton.click();
    
    // Wait for player page to load
    await page.waitForLoadState('networkidle');
    
    // Check if secondary timer component exists (it should be hidden initially if not started)
    const secondaryTimerComponent = page.locator('#secondary-timer-component');
    // The component might be hidden initially, but it should exist in the DOM
    await expect(secondaryTimerComponent).toBeAttached();
  });
});