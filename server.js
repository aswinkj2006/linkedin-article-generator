const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

app.post('/post-to-linkedin', async (req, res) => {
  const postText = req.body.text;
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const cookiesPath = path.resolve('./cookies.json');

  try {
    // ✅ Launch with correct path (auto handles download)
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),  // auto-locates the downloaded Chrome
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);
    }

    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const [startPostBtn] = await page.$x("//button[contains(., 'Start a post')]");
    if (!startPostBtn) throw new Error('Start post button not found.');
    await startPostBtn.click();
    await page.waitForTimeout(3000);

    const editor = await page.waitForSelector('div[role="textbox"]', { timeout: 10000 });
    await editor.click();
    await page.keyboard.type(postText, { delay: 20 });

    const postButton = await page.$('button.share-actions__primary-action');
    if (!postButton) throw new Error('Post button not found.');
    await postButton.click();

    await page.waitForTimeout(5000);
    const updatedCookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(updatedCookies, null, 2));

    await browser.close();
    res.status(200).json({ message: '✅ LinkedIn post successful!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
