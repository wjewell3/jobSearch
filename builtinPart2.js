const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_PATH = 'builtinCompanies.csv';
const OUTPUT_PATH = 'builtinCompaniesWithDetails.csv';
const CHUNK_SIZE = 50;

// Utility function to prompt the user
const waitForUserInput = (promptMessage) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(promptMessage, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

// Function to fetch Glassdoor rating and employee count
const fetchDetails = async (browser, companyName) => {
    const searchQuery = encodeURIComponent(`${companyName} company size site:glassdoor.com`);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

    try {
        const page = await browser.newPage();
        console.log(`Fetching details for ${companyName}...`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 }); // 30-second timeout

        // Extract rating using querySelector
        const rating = await page.evaluate(() => {
            const ratingElement = document.querySelector('span.yi40Hd.YrbPuc');
            return ratingElement ? parseFloat(ratingElement.textContent.trim()) : null;
        });

        // Extract employee count
        const employeeCount = await page.evaluate(() => {
            const emElements = Array.from(document.querySelectorAll('em'));
            const emText = emElements.map(el => el.textContent);
            return emText.find(text => text.includes('Employees')) || null;
        });

        console.log(`Fetched for ${companyName}: Rating - ${rating}, Employees - ${employeeCount}`);
        await page.close();
        return { name: companyName, rating, employeeCount };
    } catch (error) {
        console.error(`Failed to fetch details for ${companyName}: ${error.message}`);
        return { name: companyName, rating: null, employeeCount: null };
    }
};

// Function to process a chunk of companies
const processChunk = async (browser, chunk) => {
    const fetchPromises = chunk.map(companyName => fetchDetails(browser, companyName));
    return Promise.all(fetchPromises);
};

(async () => {
    const browser = await puppeteer.launch({ headless: true });

    // Read companies from CSV
    const csvContent = fs.readFileSync(path.resolve(__dirname, INPUT_PATH), 'utf-8');
    const companies = csvContent.split('\n').slice(1).map(line => line.replace(/"/g, '').trim()).filter(Boolean);

    console.log(`Loaded ${companies.length} companies from CSV.`);

    const outputPath = path.resolve(__dirname, OUTPUT_PATH);

    // Write the header to the output file
    if (!fs.existsSync(outputPath)) {
        const csvHeader = 'Company Name,Glassdoor Rating,Employee Count\n';
        fs.writeFileSync(outputPath, csvHeader);
    }

    for (let i = 0; i < companies.length; i += CHUNK_SIZE) {
        const chunk = companies.slice(i, i + CHUNK_SIZE);
        console.log(`Processing chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(companies.length / CHUNK_SIZE)}...`);

        const chunkResults = await processChunk(browser, chunk);

        // Append chunk results to the CSV file
        const csvRows = chunkResults.map(
            ({ name, rating, employeeCount }) => `"${name}",${rating || 'N/A'},"${employeeCount || 'N/A'}"`
        ).join('\n');
        fs.appendFileSync(outputPath, csvRows + '\n');

        console.log(`Chunk ${i / CHUNK_SIZE + 1} written to file.`);

        // Pause after processing a chunk
        if (i + CHUNK_SIZE < companies.length) {
            console.log('Pausing to allow VPN switch...');
            await waitForUserInput('Please switch VPN servers and press Enter to continue: ');
        }
    }

    console.log(`All details saved to ${outputPath}`);
    await browser.close();
})();
