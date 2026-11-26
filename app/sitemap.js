export default function sitemap() {
  return [
    { url: "https://tiplab.io/", changeFrequency: "hourly", priority: 1 },
    { url: "https://tiplab.io/play", changeFrequency: "daily", priority: 0.95 },
    { url: "https://tiplab.io/play/voxel-run", changeFrequency: "daily", priority: 0.9 },
    { url: "https://tiplab.io/play/legal", changeFrequency: "monthly", priority: 0.3 },
    { url: "https://tiplab.io/record", changeFrequency: "hourly", priority: 0.9 },
    { url: "https://tiplab.io/pricing", changeFrequency: "monthly", priority: 0.7 },
    { url: "https://tiplab.io/method", changeFrequency: "monthly", priority: 0.6 },
  ];
}
