import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import express from "express";

dotenv.config();

const app = express(); // Fake web server for Render
const PORT = process.env.PORT || 3000;

const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const reelsFile = "./reels.json"; // ✅ Updated to new JSON
const indexFile = "./currentIndex.txt";

// Read saved index (last posted position)
function getCurrentIndex() {
  try {
    return parseInt(fs.readFileSync(indexFile, "utf-8")) || 0;
  } catch {
    return 0;
  }
}

// Save new index
function saveNextIndex(index) {
  fs.writeFileSync(indexFile, index.toString());
}

// Load reels dynamically
function loadReels() {
  return JSON.parse(fs.readFileSync(reelsFile, "utf-8"));
}

// Wait until media is ready
async function waitForMediaReady(mediaId) {
  while (true) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v16.0/${mediaId}?fields=status_code&access_token=${ACCESS_TOKEN}`
      );
      const data = await res.json();

      if (data.status_code === "FINISHED") return;

      console.log("⏳ Media not ready yet, waiting 60 seconds...");
      await new Promise((r) => setTimeout(r, 60000));
    } catch (err) {
      console.error("❌ Error checking media status:", err.message);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

// Upload + publish reel
async function postReel(videoUrl, caption) {
  try {
    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          access_token: ACCESS_TOKEN,
        }),
      }
    );

    const createData = await createRes.json();
    console.log("Create Response:", createData);

    if (!createData.id) throw new Error("Failed to create media container");

    // Step 2: Wait until media is ready
    await waitForMediaReady(createData.id);

    // Step 3: Publish the reel
    const publishRes = await fetch(
      `https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ID}/media_publish`,
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
    console.log("Publish Response:", publishData);

    if (publishData.id) {
      console.log(`✅ Reel published successfully!`);
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

// Main posting loop
async function startPosting() {
  let index = getCurrentIndex();
  const reels = loadReels();

  if (index >= reels.length) {
    console.log("🎉 All reels have been posted. Waiting for new reels...");
    return;
  }

  while (index < reels.length) {
    const { transformed_url, caption } = reels[index]; // ✅ Updated key

    console.log(`🎬 Posting reel ${index + 1}/${reels.length}: ${caption}`);
    await postReel(transformed_url, caption); // ✅ Use transformed_url

    // Save current index
    saveNextIndex(index + 1);

    // Wait before next post
    if (index < reels.length - 1) {
      const delay = getRandomDelay();
      console.log(
        `⏳ Waiting ${Math.floor(delay / 1000 / 60)} minutes for next post...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }

    index++;
  }

  console.log("✅ All reels posted. Script will now stop.");
}

// ✅ Start autoposter in background
startPosting();

// ✅ Fake web server just to keep Render alive
app.get("/", (req, res) => {
  res.send("🚀 Instagram AutoPoster running on Render!");
});

app.listen(PORT, () =>
  console.log(`🌍 Render keep-alive server listening on port ${PORT}`)
);
