const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { parse } = require('json2csv');
const puppeteer = require('puppeteer');

const INPUT_PATH = 'builtinCompaniesWithDetailsDistinct.csv';
const OUTPUT_PATH = 'builtinCompaniesWithCareersURLs.csv';
const CONCURRENCY_LIMIT = 10;

const fetchCareersURL = async (browser, company) => {
    const searchQuery = encodeURIComponent(`${company.companyName} view job openings`);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;
    try {
        const page = await browser.newPage();
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const careersURL = await page.evaluate(() => {
            const linkElement = document.querySelector('div.yuRUbf a');
            return linkElement ? linkElement.href : null;
        });

        company.careersURL = careersURL || null; // Explicit null if no URL is found
        console.log(`Found URL for ${company.companyName}: ${company.careersURL}`);
        await page.close();
    } catch (error) {
        console.error(`Failed to fetch URL for ${company.companyName}: ${error.message}`);
        company.careersURL = null;
    }
    return company;
};

const readExistingOutput = async (outputPath) => {
    const processedCompanies = new Set();
    if (fs.existsSync(outputPath)) {
        await new Promise((resolve, reject) => {
            fs.createReadStream(path.resolve(__dirname, outputPath))
                .pipe(csvParser())
                .on('data', (row) => {
                    processedCompanies.add(row['Company Name']);
                })
                .on('end', resolve)
                .on('error', reject);
        });
    }
    return processedCompanies;
};

const appendToOutput = (row, outputPath) => {
    const csvContent = parse([row], { header: false });
    fs.appendFileSync(outputPath, `\n${csvContent}`);
};

const processInBatches = async (companies, concurrencyLimit, taskFn) => {
    const results = [];
    for (let i = 0; i < companies.length; i += concurrencyLimit) {
        const batch = companies.slice(i, i + concurrencyLimit);
        console.log(`Processing batch: ${i / concurrencyLimit + 1}/${Math.ceil(companies.length / concurrencyLimit)}`);
        const batchResults = await Promise.all(batch.map(taskFn));
        results.push(...batchResults);
    }
    return results;
};

(async () => {
    try {
        const companies = [];
        console.log(`Reading input CSV from ${INPUT_PATH}...`);
        await new Promise((resolve, reject) => {
            fs.createReadStream(path.resolve(__dirname, INPUT_PATH))
                .pipe(csvParser())
                .on('data', (row) => {
                    companies.push({
                        companyName: row['Company Name'].trim(),
                        rating: row['Max Glassdoor Rating'],
                        employeeCount: row['Max Employee Count'],
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });
        console.log(`Loaded ${companies.length} companies.`);

        const processedCompanies = await readExistingOutput(OUTPUT_PATH);
        console.log(`Skipping ${processedCompanies.size} already processed companies.`);

        const browser = await puppeteer.launch({ headless: true });

        // Filter companies to process only unprocessed ones
        const companiesToProcess = companies.filter(
            (company) => !processedCompanies.has(company.companyName)
        );

        // Process in batches with concurrency
        await processInBatches(companiesToProcess, CONCURRENCY_LIMIT, async (company) => {
            const result = await fetchCareersURL(browser, company);

            if (result.careersURL) { // Append only if URL is found
                const row = {
                    'Company Name': result.companyName,
                    'Max Glassdoor Rating': result.rating,
                    'Max Employee Count': result.employeeCount,
                    'Careers Site URL': result.careersURL,
                };
                appendToOutput(row, OUTPUT_PATH);
                console.log(`Appended company: ${company.companyName}`);
            } else {
                console.log(`No URL found for ${company.companyName}, skipping.`);
            }
        });

        await browser.close();
        console.log(`Processing complete.`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
