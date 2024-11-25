const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set User-Agent to avoid bot detection
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    const searchQuery = encodeURIComponent('Fathom site:glassdoor.com');
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;
    // console.log(`Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    const pageContent = await page.content();
    const ratingMatch = pageContent.match(/Rated (\d+\.\d+) out of 5/);
    console.log(ratingMatch[1]);
    await browser.close();
})();
