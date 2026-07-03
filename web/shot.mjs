import { chromium } from "playwright";
import { mkdirSync } from "fs";

mkdirSync("shots", { recursive: true });
const base = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch();

async function shot(name, url, { full = false, w = 1440, h = 900, wait = 1800 } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  try {
    await p.goto(base + url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    /* ignore network idle timeout */
  }
  await p.waitForTimeout(wait);
  if (full) {
    // scroll through to trigger IntersectionObserver reveals, then back to top
    await p.evaluate(async () => {
      const step = window.innerHeight * 0.7;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 220));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
  }
  await p.screenshot({ path: `shots/${name}`, fullPage: full });
  await p.close();
  console.log("shot", name);
}

await shot("landing.png", "/");
await shot("landing-full.png", "/", { full: true });
await shot("trade.png", "/trade", { h: 1050 });
await shot("landing-mobile.png", "/", { w: 390, h: 844, full: true });
await b.close();
console.log("done");
