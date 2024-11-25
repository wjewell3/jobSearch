const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true }); // Change to true for production
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    // Navigate to the target URL
    await page.goto('https://www.keragon.com/blog/healthcare-ai-companies', { waitUntil: 'load', timeout: 0 });

    // Extract company names and URLs
    const companies = await page.evaluate(() => {
        const companyData = [];
        const excludedUrls = ['keragon.com','viz.ai', 'care.ai', 'teton.ai', 'basys.ai', 'genhealth.ai'];

        const companyElements = document.querySelectorAll('h3 > strong'); // Company names
        const linkElements = Array.from(document.querySelectorAll('a[href]')) // Links
            .filter(link => !excludedUrls.some(excluded => link.href.includes(excluded))); // Filter unwanted links

        companyElements.forEach((element, index) => {
            const companyName = element.innerText.trim();
            const linkElement = linkElements[index];
            const companyUrl = linkElement ? linkElement.href.trim() : null;
            companyData.push({ name: companyName, url: companyUrl });
        });

        return companyData;
    });

    console.log('Extracted companies:', companies);

    // Function to fetch Glassdoor rating
    const fetchRating = async (browser, company) => {
        const searchQuery = encodeURIComponent(`${company.name} site:glassdoor.com`);
        const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

        const page = await browser.newPage();
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 0 });

        const pageContent = await page.content();
        const ratingMatch = pageContent.match(/Rated (\d+\.\d+) out of 5/); // Use original regex logic
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
        console.log(company.name, rating);

        await page.close();
        return { ...company, rating };
    };

    // Run rating fetches in parallel
    const results = await Promise.all(
        companies.map(company => fetchRating(browser, company))
    );

    // Sort by Glassdoor rating descending
    const sortedResults = results
        .filter(company => company.rating !== null) // Exclude companies without ratings
        .sort((a, b) => b.rating - a.rating);

    console.log('Sorted results:', sortedResults);

    // Save results to CSV
    const csvHeader = 'Company Name,URL,Glassdoor Rating\n';
    const csvRows = sortedResults.map(
        ({ name, url, rating }) => `"${name}","${url}",${rating}`
    );
    const csvContent = csvHeader + csvRows.join('\n');

    const outputPath = path.resolve(__dirname, 'companies_sorted.csv');
    fs.writeFileSync(outputPath, csvContent);
    console.log(`Results saved to ${outputPath}`);

    await browser.close();
})();
