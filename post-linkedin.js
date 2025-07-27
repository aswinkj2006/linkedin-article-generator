const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.RENDER;
let puppeteer, chromium;
if (isServerless) {
  chromium = require('chrome-aws-lambda');
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}
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
  const launchOptions = isServerless
    ? {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true
      }
    : {
        headless: false,
        args: ['--start-maximized']
      };
  const browser = await puppeteer.launch(launchOptions);

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
    await browser.close();
    return;
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
  }

  // 🧼 Wait and save updated cookies
  await page.waitForTimeout(5000);
  const updatedCookies = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(updatedCookies, null, 2));
  console.log('💾 Cookies updated');

  await browser.close();
})();
