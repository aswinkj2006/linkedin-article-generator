const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// ✅ Get post content from CLI
const postText = process.argv[2];
if (!postText) {
  console.error('❌ Please provide the post content as a command-line argument.');
  process.exit(1);
}

const cookiesPath = path.resolve('./cookies.json');


(async () => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true
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

  console.log('⏳ Waiting for feed to load...');
  await page.waitForTimeout(5000);

  // 📝 Click "Start a post"
  const [startPostBtn] = await page.$x("//button[contains(., 'Start a post')]");
  if (!startPostBtn) {
    console.error('❌ Start a post button not found!');
    await browser.close();
    return;
  }
  await startPostBtn.click();
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
  }

  // 🧼 Wait and save updated cookies
  await page.waitForTimeout(5000);
  const updatedCookies = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(updatedCookies, null, 2));
  console.log('💾 Cookies updated');

  await browser.close();
})();
