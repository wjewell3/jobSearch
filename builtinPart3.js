const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { parse } = require('json2csv');

const INPUT_PATH = 'builtinCompaniesWithDetails.csv'; // Replace with your input CSV file name
const OUTPUT_PATH = 'builtinCompaniesWithDetailsDistinct.csv'; // Replace with your desired output file name

(async () => {
    try {
        const companies = {};

        // Step 1: Read the input CSV file
        console.log(`Reading input CSV from ${INPUT_PATH}...`);
        await new Promise((resolve, reject) => {
            fs.createReadStream(path.resolve(__dirname, INPUT_PATH))
                .pipe(csvParser())
                .on('data', (row) => {
                    const companyName = row['Company Name'].trim();
                    const rating = parseFloat(row['Glassdoor Rating']);
                    const employeeCount = parseInt(row['Employee Count'].replace(/[^\d]/g, '') || '0', 10);

                    if (!companies[companyName]) {
                        companies[companyName] = { rating: rating || 0, employeeCount: employeeCount || 0 };
                    } else {
                        companies[companyName].rating = Math.max(companies[companyName].rating, rating || 0);
                        companies[companyName].employeeCount = Math.max(companies[companyName].employeeCount, employeeCount || 0);
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Step 2: Transform the grouped data into an array, filter by rating >= 3.8, and sort
        const results = Object.entries(companies)
            .filter(([_, { rating }]) => rating >= 3.8) // Only include companies with rating >= 3.8
            .map(([name, { rating, employeeCount }]) => ({
                'Company Name': name,
                'Max Glassdoor Rating': rating || 'N/A',
                'Max Employee Count': employeeCount || 'N/A',
            }))
            .sort((a, b) => {
                // Sort by rating (descending), then by name (descending)
                if (b['Max Glassdoor Rating'] !== a['Max Glassdoor Rating']) {
                    return b['Max Glassdoor Rating'] - a['Max Glassdoor Rating'];
                }
                return b['Company Name'].localeCompare(a['Company Name']);
            });

        // Step 3: Write the results to a new CSV file
        console.log(`Writing results to ${OUTPUT_PATH}...`);
        const csvContent = parse(results);
        fs.writeFileSync(path.resolve(__dirname, OUTPUT_PATH), csvContent);

        console.log(`Successfully written output to ${OUTPUT_PATH}.`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
