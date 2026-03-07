const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    page.on('response', response => {
        if (!response.ok()) console.log('NETWORK ERROR:', response.status(), response.url());
    });

    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/teacher-login');

    console.log('Typing credentials...');
    await page.type('input[type="email"]', 'teacher@example.com'); // Will be rejected, but then I'll use a better one or just use standard failure
    // It's fine, if we can login we will see.
    // Let me try to find valid credentials from db

    await browser.close();
})();
