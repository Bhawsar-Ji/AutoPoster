import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const reelsFile = "./reels.json";
const indexFile = "./currentIndex.txt";

// Read saved index (last posted position)
function getCurrentIndex() {
  try {
    return parseInt(fs.readFileSync(indexFile, "utf-8"));
  } catch {
    return 0;
  }
}

// Save new index
function saveNextIndex(index) {
  fs.writeFileSync(indexFile, index.toString());
}

// Load reels dynamically (if updated)
function loadReels() {
  return JSON.parse(fs.readFileSync(reelsFile, "utf-8"));
}

// Upload + publish reel
async function postReel(video_url, caption) {
  try {
    // Step 1: Create upload container
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${INSTAGRAM_BUSINESS_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: video_url,
          caption,
          access_token: ACCESS_TOKEN,
        }),
      }
    );
    const createData = await createRes.json();

    if (!createData.id) throw new Error("Failed to create container");

    // Step 2: Publish the reel
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${INSTAGRAM_BUSINESS_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: ACCESS_TOKEN,
        }),
      }
    );

    const publishData = await publishRes.json();

    if (publishData.id) {
      console.log("✅ Reel published successfully!");
    } else {
      console.error("❌ Failed to publish reel:", publishData);
    }
  } catch (err) {
    console.error("❌ Error posting reel:", err.message);
  }
}

// Random delay between 1–3 hours
function getRandomDelay() {
  const min = 60 * 60 * 1000; // 1 hour
  const max = 3 * 60 * 60 * 1000; // 3 hours
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Main loop
async function startPosting() {
  let index = getCurrentIndex();
  const reels = loadReels();

  if (index >= reels.length) {
    console.log("🎉 All reels have been posted. Waiting for new reels...");
    return;
  }

  while (index < reels.length) {
    const { url, caption } = reels[index];
    console.log(`🎬 Posting reel ${index + 1}/${reels.length}: ${caption}`);
    await postReel(url, caption);

    // Save current index (for next restart)
    saveNextIndex(index + 1);

    // Wait random delay (1–3 hours)
    if (index < reels.length - 1) {
      const delay = getRandomDelay();
      console.log(`⏳ Waiting ${Math.floor(delay / 1000 / 60)} minutes for next post...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    index++;
  }

  console.log("✅ All reels posted. Script will now stop.");
}

startPosting();
