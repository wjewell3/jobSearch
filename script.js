const puppeteer = require('puppeteer');
(async () => {
    // Launch the Puppeteer browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to the target URL
    await page.goto('https://www.keragon.com/blog/healthcare-ai-companies', { waitUntil: 'load', timeout: 0 });

    // Extract company names and their respective URLs
    const companies = await page.evaluate(() => {
        const companyData = [];

        // Select the elements containing company names and URLs
        const companyElements = document.querySelectorAll('h3 > strong'); // Select all <h3> > <strong> tags
        let linkElements = document.querySelectorAll('a[href]'); // Select all <a> tags with href attribute

        const excludedUrls = ['viz.ai', 'care.ai', 'teton.ai', 'basys.ai','genhealth.ai'];
        // Filter out any link elements with URLs that contain 'viz.ai'
        linkElements = Array.from(linkElements).filter(link => 
            !excludedUrls.some(excluded => link.href.includes(excluded))
        );        

        // Loop through each company name element
        companyElements.forEach((element, index) => {
            const companyName = element.innerText.trim();
            
            // Ensure there is a corresponding valid link element
            const linkElement = linkElements[index+9];
            if (linkElement) {
                const companyUrl = linkElement.href.trim();
                companyData.push({ name: companyName, url: companyUrl });
            }
        });
        
        return companyData;
    });

    // Display the result
    console.log(companies);
    console.log(companies.slice(-27));


    // Close the browser
    await browser.close();
})();
