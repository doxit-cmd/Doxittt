export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Link kosong" });

  const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  try {
    const cleanUrl = url.split("?")[0];

    // NEMBAK KE TIKTOKIO
    const response = await fetch("https://tiktokio.com/api/v1/tk/html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CHROME_UA,
        Origin: "https://tiktokio.com",
        Referer: "https://tiktokio.com/"
      },
      body: JSON.stringify({ vid: cleanUrl, prefix: "tiktokio.com" })
    });

    const html = await response.text();

    if (!html || typeof html !== "string" || html.includes("Please paste a valid link") || html.includes("Error")) {
      throw new Error("Gagal memproses. TikTokIO nge-blokir request atau link invalid.");
    }

    let title = "TikTok Content";
    const titleMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, "").trim();

    let thumbnail = "";
    const thumbMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (thumbMatch) thumbnail = thumbMatch[1].replace(/&#38;/g, "&");

    const authorMatch = cleanUrl.match(/@([^\/]+)/);
    const author = authorMatch ? authorMatch[1] : "Unknown";

    const downloads = [];
    const photos = [];
    let videoUrl = "";
    let audioUrl = "";

    // DETEKSI SLIDE FOTO
    const isSlideshow = html.includes('class="images-grid"') || html.includes('class="image-item"');

    if (isSlideshow) {
      const slidesRegex = /<div[^>]*class=["'][^"']*image-item[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;
      let slideMatch;
      while ((slideMatch = slidesRegex.exec(html)) !== null) {
        const slideHtml = slideMatch[0];
        const aHref = slideHtml.match(/href=["']([^"']+)/i);
        if (aHref && aHref[1] !== "#") {
          const photoUrl = aHref[1].replace(/&#38;/g, "&");
          if (!photos.includes(photoUrl)) photos.push(photoUrl);
        } else {
          const imgSrc = slideHtml.match(/src=["']([^"']+)/i);
          if (imgSrc) {
            const photoUrl = imgSrc[1].replace(/&#38;/g, "&");
            if (!photos.includes(photoUrl)) photos.push(photoUrl);
          }
        }
      }

      // Ambil MP3 kalau di slideshow ada tombol MP3
      const mp3TagRegex = /<a[\s\S]*?<\/a>/gi;
      let mp3Match;
      while ((mp3Match = mp3TagRegex.exec(html)) !== null) {
        const tag = mp3Match[0];
        if (tag.includes("download-btn-purple") || tag.toLowerCase().includes("mp3") || tag.toLowerCase().includes("music")) {
          const h = tag.match(/href=["']([^"']+)/i);
          if (h && h[1] !== "#") {
            audioUrl = h[1].replace(/&#38;/g, "&");
            break; // Ambil satu aja
          }
        }
      }
    } 
    // DETEKSI VIDEO BIASA
    else {
      const anchorTagRegex = /<a[\s\S]*?<\/a>/gi;
      let anchorMatch;
      while ((anchorMatch = anchorTagRegex.exec(html)) !== null) {
        const tag = anchorMatch[0];
        if (!tag.includes("download-btn")) continue;

        const hrefM = tag.match(/href=["']([^"']+)/i);
        if (!hrefM || hrefM[1] === "#") continue;
        
        const href = hrefM[1].replace(/&#38;/g, "&");
        const innerText = tag.replace(/<[^>]+>/g, "").trim().toLowerCase();

        let label = null;
        if (innerText.includes("without watermark") || tag.includes("download-btn-blue") || tag.includes("download-btn-green")) {
          label = "VIDEO";
        } else if (innerText.includes("mp3") || innerText.includes("music") || tag.includes("download-btn-purple")) {
          label = "MP3";
        }

        if (label === "VIDEO" && !videoUrl) videoUrl = href;
        if (label === "MP3" && !audioUrl) audioUrl = href;
      }
    }

    if (photos.length === 0 && !videoUrl && !audioUrl) {
      throw new Error("Tidak ada link video, foto, atau MP3 yang ditemukan.");
    }

    // KIRIM HASIL KE FRONTEND
    res.status(200).json({
      success: true,
      title: title,
      author: author,
      thumbnail: thumbnail,
      photos: photos,       // Kirim array foto
      video_url: videoUrl,  // Kirim link video
      audio_url: audioUrl   // Kirim link MP3
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}