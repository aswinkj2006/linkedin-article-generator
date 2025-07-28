const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
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
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // ✅ Load existing cookies
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);
      console.log('✅ Cookies loaded');
    } else {
      console.warn('⚠️ No cookies found! Login may be required.');
    }

    // 🌐 Go to LinkedIn Feed
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 0
    });

    // Handle LinkedIn "Welcome Back" page if shown
    try {
      await page.waitForSelector('button[aria-label*="Asween Mass Boy"]', { timeout: 5000 });
      await page.click('button[aria-label*="Asween Mass Boy"]');
      console.log('✅ Clicked user profile on Welcome Back page');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (e) {
      // If not found, continue as normal
      console.log('ℹ️ Welcome Back page not shown, continuing...');
    }

    console.log('⏳ Waiting for feed to load...');
    await page.waitForTimeout(5000);

    // Debug: Output current URL and a snippet of HTML
    const currentUrl = page.url();
    const pageContent = await page.content();
    console.log('� Current URL:', currentUrl);
    console.log('🔎 Page HTML snippet:', pageContent.substring(0, 1000));

    // �📝 Try multiple selectors for "Start a post"
    let startPostBtn = await page.$x("//button[contains(., 'Start a post')]");
    if (!startPostBtn || !startPostBtn[0]) {
      // Try alternative selectors
      startPostBtn = await page.$x("//button[contains(@aria-label, 'Start a post')]");
    }
    if (!startPostBtn || !startPostBtn[0]) {
      startPostBtn = await page.$('button.share-box-feed-entry__trigger');
      if (startPostBtn) startPostBtn = [startPostBtn];
    }
    if (!startPostBtn || !startPostBtn[0]) {
      console.error('❌ Start post button not found!');
      // Log the HTML snippet for debugging
      console.log('� Full HTML snippet:', pageContent.substring(0, 2000));
      await browser.close();
      return res.status(500).json({ error: 'Start post button not found!' });
    }
    await startPostBtn[0].click();
    console.log('✅ Clicked Start a post');
    await page.waitForTimeout(3000);

    // ✍️ Type post content
    const editor = await page.waitForSelector('div[role="textbox"]', { timeout: 10000 });
    await editor.click();
    await page.keyboard.type(postText, { delay: 20 });
    console.log('✍️ Typed post content');

    await page.waitForTimeout(2000);

    // 🚀 Click Post button
    const postButton = await page.$('button.share-actions__primary-action');
    if (postButton) {
      await postButton.click();
      console.log('🚀 Post submitted!');
    } else {
      console.error('❌ Could not find the Post button!');
      await browser.close();
      return res.status(500).json({ error: 'Post button not found!' });
    }

    // 🧼 Wait and save updated cookies
    await page.waitForTimeout(5000);
    const updatedCookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(updatedCookies, null, 2));
    console.log('💾 Cookies updated');

    await browser.close();
    res.status(200).json({ message: '✅ LinkedIn post successful!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
