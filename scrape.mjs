import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

const tasks = [
  {
    name: 'FZMoviesCC',
    movieUrl: 'https://fzmovies.cc/movie-Men%20in%20Black%20International--hmp4.htm',
    steps: [
      { desc: 'Click 480p download', selector: 'a[href*="download1.php"]' },
      { desc: 'Click download button on next page', selector: 'a[href*="download"], button, input[type="submit"]', waitAfter: 5000 },
    ]
  },
  {
    name: 'MobileTVShows',
    movieUrl: 'https://mobiletvshows.site/subfolder-New%20Girl.htm',
    steps: [
      { desc: 'Click High MP4', selector: 'a[href*="episode.php"][href*="ftype=2"]' },
      { desc: 'Click download on episode page', selector: 'a[href*="downloadmp4"], a:has-text("Download"), button', waitAfter: 5000 },
    ]
  },
  {
    name: 'FZTVSeries',
    movieUrl: 'https://fztvseries.live/subfolder-New%20Girl.htm',
    steps: [
      { desc: 'Click High MP4', selector: 'a[href*="episode.php"][href*="ftype=2"]' },
      { desc: 'Click download on episode page', selector: 'a[href*="downloadmp4"], a:has-text("Download"), button', waitAfter: 5000 },
    ]
  },
  {
    name: 'TVSeriesIN',
    movieUrl: 'https://tvseries.in',
    steps: [
      { desc: 'Click first episode', selector: 'a[href*="episode.php"]' },
      { desc: 'Click download', selector: 'a[href*="download"], a:has-text("Download"), button', waitAfter: 5000 },
    ]
  },
  {
    name: 'FZMoviesLive',
    movieUrl: 'https://fzmovies.live',
    steps: [
      { desc: 'Click first movie', selector: 'a[href*="movie-"][href*="hmp4"]' },
      { desc: 'Click download', selector: 'a[href*="download1.php"]', waitAfter: 3000 },
      { desc: 'Click download button', selector: 'a:has-text("Download"), button, input[type="submit"]', waitAfter: 5000 },
    ]
  },
  {
    name: 'Net9ja',
    movieUrl: 'https://www.net9ja.tv/above-the-line-2025/',
    steps: [
      { desc: 'Click DOWNLOAD', selector: 'a:has-text("DOWNLOAD")' },
      { desc: 'Click SDM download', selector: 'a[href*="sdm_process_download"], a.sdm_download', waitAfter: 5000 },
    ]
  },
  {
    name: 'Net9jaSeries',
    movieUrl: 'https://net9jaseries.com/avatar-the-last-airbender-season-2/',
    steps: [
      { desc: 'Click Episode 1', selector: 'a[href*="wildshare"]' },
      { desc: 'Click Download on wildshare', selector: '.wildbutton, a:has-text("Download"), button', waitAfter: 5000 },
    ]
  },
];

for (const task of tasks) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${task.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Capture ALL requests
    const videoUrls = [];
    const downloadUrls = [];
    
    page.on('request', (req) => {
      const u = req.url();
      if (u.match(/\.(mp4|mkv|webm|avi|m3u8|mpd)(\?|$)/i)) {
        videoUrls.push(u);
        console.log(`  🎬 VIDEO: ${u.substring(0, 200)}`);
      }
    });
    
    page.on('response', async (res) => {
      const ct = res.headers()['content-type'] || '';
      const cd = res.headers()['content-disposition'] || '';
      if (ct.includes('video') || ct.includes('octet-stream') || cd.includes('attachment')) {
        downloadUrls.push({ url: res.url(), type: ct, disposition: cd, status: res.status() });
        console.log(`  ✅ FILE: HTTP ${res.status()} [${ct}] ${res.url().substring(0, 200)}`);
      }
    });
    
    page.on('download', (dl) => {
      console.log(`  📥 DOWNLOAD STARTED: ${dl.url()}`);
      console.log(`  📁 Filename: ${dl.suggestedFilename()}`);
    });
    
    // Step 1: Go to movie page
    console.log(`  Step 1: ${task.movieUrl}`);
    await page.goto(task.movieUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Step 2+: Click through the chain
    for (const step of task.steps) {
      console.log(`  Step: ${step.desc} [${step.selector}]`);
      try {
        const btn = await page.$(step.selector);
        if (btn) {
          // Check if it's a link we should navigate to, or a button to click
          const tagName = await btn.evaluate(el => el.tagName.toLowerCase());
          const href = await btn.evaluate(el => el.getAttribute('href'));
          const onclick = await btn.evaluate(el => el.getAttribute('onclick'));
          
          console.log(`    Tag: ${tagName}, href: ${href?.substring(0, 80)}, onclick: ${!!onclick}`);
          
          // Click it
          await btn.click();
          
          // Wait for things to happen
          const waitMs = step.waitAfter || 3000;
          console.log(`    Waiting ${waitMs}ms...`);
          await page.waitForTimeout(waitMs);
          
          console.log(`    Current URL: ${page.url().substring(0, 150)}`);
        } else {
          console.log(`    Button not found: ${step.selector}`);
        }
      } catch(e) {
        console.log(`    Click error: ${e.message}`);
      }
    }
    
    // Final summary
    console.log(`\n  === ${task.name} SUMMARY ===`);
    console.log(`  Video requests: ${videoUrls.length}`);
    console.log(`  File downloads: ${downloadUrls.length}`);
    if (videoUrls.length > 0) {
      console.log(`  🎬 ${videoUrls[0].substring(0, 200)}`);
    }
    if (downloadUrls.length > 0) {
      downloadUrls.forEach(d => console.log(`  ✅ ${d.url.substring(0, 200)}`));
    }
    
    await context.close();
  } catch(e) {
    console.log(`  Error: ${e.message}`);
  }
}

await browser.close();
console.log('\n\n✅ ALL DONE!');
