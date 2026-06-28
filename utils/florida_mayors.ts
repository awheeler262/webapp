import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outfile = path.resolve("./tests/data/florida-mayors.json");
const url = "https://www.floridamayors.org/member-directory/";
const regex = /([a-zA-Z0-9 ]+?)\t\t\tx\t\t\t\tMayor: ([a-zA-Z .-]+?) Address:/g;
const locators = [
  "#ab-list",
  "#cd-list",
  "#ef-list",
  "#gh-list",
  "#ij-list",
  "#kl-list",
  "#mn-list",
  "#op-list",
  "#qr-list",
  "#st-list",
  "#uv-list",
  "#wx-list",
  "#yz-list",
];
const data = new Map();

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);

for (const locator of locators) {
  await page.locator(locator).click();
  const text = await page.locator(locator).allTextContents();
  const items = [];
  for( const x of text[0].matchAll(regex)) {
    const item = x[1].trim() + " | " + x[2].trim();
    items.push(item);
  }
  data.set(locator, items);
}
await browser.close();

const json = JSON.stringify(Object.fromEntries(data), null, 2);
console.log(json);
console.log("Count: " + data.size);

fs.writeFile(outfile, json, 'utf8', (err: any) => {
    if (err) {
        console.error("An error occurred while writing the file:", err);
        return;
    }
    console.log("Data saved to " + outfile);
});
