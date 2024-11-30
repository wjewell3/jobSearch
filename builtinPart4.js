const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_PATH = 'builtinCompaniesWithDetailsDistinct.csv';
const OUTPUT_PATH = 'builtinCompaniesWithDetailsDistinctHighRatings.csv';
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

    // Read companies from the input CSV
    const csvContent = fs.readFileSync(path.resolve(__dirname, INPUT_PATH), 'utf-8');
    const companies = csvContent.split('\n').slice(1).map(line => line.replace(/"/g, '').trim()).filter(Boolean);

    // Check for existing output file and determine already processed companies
    let processedCompanies = [];
    if (fs.existsSync(OUTPUT_PATH)) {
        const outputContent = fs.readFileSync(path.resolve(__dirname, OUTPUT_PATH), 'utf-8');
        processedCompanies = outputContent.split('\n').slice(1).map(line => line.split(',')[0].replace(/"/g, '').trim());
    }

    const remainingCompanies = companies.filter(company => !processedCompanies.includes(company));
    console.log(`Found ${remainingCompanies.length} companies remaining to process.`);

    const totalChunks = Math.ceil(remainingCompanies.length / CHUNK_SIZE);
    let allResults = [];

    for (let i = 0; i < remainingCompanies.length; i += CHUNK_SIZE) {
        const chunk = remainingCompanies.slice(i, i + CHUNK_SIZE);
        console.log(`Processing chunk ${i / CHUNK_SIZE + 1} of ${totalChunks}...`);

        const chunkResults = await processChunk(browser, chunk);

        // Append chunk results to the output file
        const csvRows = chunkResults.map(
            ({ name, rating, employeeCount }) => `"${name}",${rating || 'N/A'},"${employeeCount || 'N/A'}"`
        ).join('\n');
        fs.appendFileSync(path.resolve(__dirname, OUTPUT_PATH), csvRows + '\n');

        console.log(`Chunk ${i / CHUNK_SIZE + 1} written to file.`);

        // Pause after processing a chunk
        if (i + CHUNK_SIZE < remainingCompanies.length) {
            console.log('Pausing to allow VPN switch...');
            await waitForUserInput('Please switch VPN servers and press Enter to continue: ');
        }
    }

    console.log(`All details saved to ${OUTPUT_PATH}`);
    await browser.close();
})();
