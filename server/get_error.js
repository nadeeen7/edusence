const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    console.log("Navigating to dashboard...");
    await page.goto('http://localhost:5173/student-dashboard');

    // Set fake login data
    await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({ id: 99, name: 'Puppeteer', role: 'student' }));
        localStorage.setItem('token', 'fake_token');
        localStorage.setItem('active_class_code', 'ABCD');
    });

    console.log("Navigating to monitor...");
    await page.goto('http://localhost:5173/monitor?room=ABCD', { waitUntil: 'networkidle0' });

    // wait a bit for react errors
    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
