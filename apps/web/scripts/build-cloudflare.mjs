import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ROOT = path.join(APP_ROOT, "public");
const DATA_ROOT = path.join(PUBLIC_ROOT, "data");
const OUTPUT_ROOT = path.join(APP_ROOT, "out");
const RELEASE_TAG = "v1.2.0-assets";
const DATA_SHA256 = "91f21806d43e95a229785b7f84d69b05cbed63fbeaff361f6e72d0c0823754bd";
const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

if (!ASSET_BASE_URL || !/^https:\/\//i.test(ASSET_BASE_URL)) {
  throw new Error("Set NEXT_PUBLIC_ASSET_BASE_URL to the HTTPS R2 asset domain before building.");
}

async function prepareData() {
  const indexPath = path.join(DATA_ROOT, "index.json");
  if (await fs.access(indexPath).then(() => true, () => false)) {
    await rewriteAssetPaths(DATA_ROOT);
    return;
  }

  const existing = await fs.readdir(DATA_ROOT).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (existing.length > 0) throw new Error(`Found ${DATA_ROOT} without index.json; refusing to overwrite it.`);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cstf-cloudflare-"));
  const zipPath = path.join(tempRoot, "data.zip");
  try {
    const url = `https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/releases/download/${RELEASE_TAG}/data.zip`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not download static data (${response.status} ${response.statusText}).`);
    const archive = Buffer.from(await response.arrayBuffer());
    const actualHash = createHash("sha256").update(archive).digest("hex");
    if (actualHash !== DATA_SHA256) throw new Error(`Static data checksum mismatch for ${RELEASE_TAG}.`);
    await fs.writeFile(zipPath, archive);
    await fs.mkdir(DATA_ROOT, { recursive: true });
    execFileSync("unzip", ["-q", zipPath, "-d", DATA_ROOT], { stdio: "inherit" });
    await rewriteAssetPaths(DATA_ROOT);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function rewriteValue(value) {
  if (typeof value === "string") {
    if (/^\/(audio|textbook-pages|story-images)\//.test(value)) {
      return `${ASSET_BASE_URL}${value}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteValue(child)]));
  }
  return value;
}

async function rewriteAssetPaths(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteAssetPaths(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      const document = JSON.parse(await fs.readFile(entryPath, "utf8"));
      await fs.writeFile(entryPath, `${JSON.stringify(rewriteValue(document), null, 2)}\n`, "utf8");
    }
  }
}

await prepareData();
execFileSync("npm", ["run", "build:next"], { cwd: APP_ROOT, stdio: "inherit" });

for (const directory of ["audio", "story-images", "textbook-pages"]) {
  await fs.rm(path.join(OUTPUT_ROOT, directory), { recursive: true, force: true });
}
