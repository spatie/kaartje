// Run with: bun packages/api/src/scripts/seed-postcards.ts

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  },
  forcePathStyle: true,
});
const S3_BUCKET = process.env.S3_BUCKET ?? "kaartje-postcards";

/** Download image from picsum, convert to AVIF, upload to MinIO. Returns the S3 key. */
async function ensureImage(index: number): Promise<string> {
  const key = `seed/card-${index}.avif`;

  // Skip if already uploaded
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return key;
  } catch {
    // Not found — download, convert, and upload
  }

  const url = `https://picsum.photos/seed/kaartje${index}/400/267`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch image ${index}: ${res.status}`);
  const jpegBuffer = Buffer.from(await res.arrayBuffer());

  // Convert to AVIF (40-50% smaller than JPEG at similar quality)
  const avifBuffer = await sharp(jpegBuffer)
    .avif({ quality: 60 })
    .toBuffer();

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: avifBuffer,
      ContentType: "image/avif",
    }),
  );

  return key;
}

const CITIES = [
  { city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
  { city: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 },
  { city: "New York", country: "USA", latitude: 40.7128, longitude: -74.006 },
  { city: "São Paulo", country: "Brazil", latitude: -23.5505, longitude: -46.6333 },
  { city: "Mumbai", country: "India", latitude: 19.076, longitude: 72.8777 },
  { city: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357 },
  { city: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
  { city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { city: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
  { city: "Moscow", country: "Russia", latitude: 55.7558, longitude: 37.6173 },
  { city: "Beijing", country: "China", latitude: 39.9042, longitude: 116.4074 },
  { city: "Seoul", country: "South Korea", latitude: 37.5665, longitude: 126.978 },
  { city: "Mexico City", country: "Mexico", latitude: 19.4326, longitude: -99.1332 },
  { city: "Buenos Aires", country: "Argentina", latitude: -34.6037, longitude: -58.3816 },
  { city: "Lagos", country: "Nigeria", latitude: 6.5244, longitude: 3.3792 },
  { city: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219 },
  { city: "Istanbul", country: "Turkey", latitude: 41.0082, longitude: 28.9784 },
  { city: "Bangkok", country: "Thailand", latitude: 13.7563, longitude: 100.5018 },
  { city: "Jakarta", country: "Indonesia", latitude: -6.2088, longitude: 106.8456 },
  { city: "Karachi", country: "Pakistan", latitude: 24.8607, longitude: 67.0011 },
  { city: "Dhaka", country: "Bangladesh", latitude: 23.8103, longitude: 90.4125 },
  { city: "Manila", country: "Philippines", latitude: 14.5995, longitude: 120.9842 },
  { city: "Osaka", country: "Japan", latitude: 34.6937, longitude: 135.5023 },
  { city: "Kinshasa", country: "DR Congo", latitude: -4.4419, longitude: 15.2663 },
  { city: "Lima", country: "Peru", latitude: -12.0464, longitude: -77.0428 },
  { city: "Bogotá", country: "Colombia", latitude: 4.711, longitude: -74.0721 },
  { city: "Santiago", country: "Chile", latitude: -33.4489, longitude: -70.6693 },
  { city: "Johannesburg", country: "South Africa", latitude: -26.2041, longitude: 28.0473 },
  { city: "Casablanca", country: "Morocco", latitude: 33.5731, longitude: -7.5898 },
  { city: "Addis Ababa", country: "Ethiopia", latitude: 9.03, longitude: 38.74 },
  { city: "Riyadh", country: "Saudi Arabia", latitude: 24.6877, longitude: 46.7219 },
  { city: "Tehran", country: "Iran", latitude: 35.6892, longitude: 51.389 },
  { city: "Baghdad", country: "Iraq", latitude: 33.3152, longitude: 44.3661 },
  { city: "Kabul", country: "Afghanistan", latitude: 34.5553, longitude: 69.2075 },
  { city: "Tashkent", country: "Uzbekistan", latitude: 41.2995, longitude: 69.2401 },
  { city: "Kuala Lumpur", country: "Malaysia", latitude: 3.139, longitude: 101.6869 },
  { city: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { city: "Ho Chi Minh City", country: "Vietnam", latitude: 10.8231, longitude: 106.6297 },
  { city: "Yangon", country: "Myanmar", latitude: 16.8661, longitude: 96.1951 },
  { city: "Kolkata", country: "India", latitude: 22.5726, longitude: 88.3639 },
  { city: "Chennai", country: "India", latitude: 13.0827, longitude: 80.2707 },
  { city: "Lahore", country: "Pakistan", latitude: 31.5204, longitude: 74.3587 },
  { city: "Guangzhou", country: "China", latitude: 23.1291, longitude: 113.2644 },
  { city: "Shenzhen", country: "China", latitude: 22.5431, longitude: 114.0579 },
  { city: "Chongqing", country: "China", latitude: 29.4316, longitude: 106.9123 },
  { city: "Taipei", country: "Taiwan", latitude: 25.033, longitude: 121.5654 },
  { city: "Hong Kong", country: "China", latitude: 22.3193, longitude: 114.1694 },
  { city: "Auckland", country: "New Zealand", latitude: -36.8485, longitude: 174.7633 },
  { city: "Melbourne", country: "Australia", latitude: -37.8136, longitude: 144.9631 },
  { city: "Accra", country: "Ghana", latitude: 5.6037, longitude: -0.187 },
  { city: "Abidjan", country: "Ivory Coast", latitude: 5.3599, longitude: -4.0083 },
  { city: "Dar es Salaam", country: "Tanzania", latitude: -6.792, longitude: 39.2083 },
  { city: "Khartoum", country: "Sudan", latitude: 15.5007, longitude: 32.5599 },
  { city: "Luanda", country: "Angola", latitude: -8.8368, longitude: 13.2343 },
  { city: "Kampala", country: "Uganda", latitude: 0.3476, longitude: 32.5825 },
  { city: "Algiers", country: "Algeria", latitude: 36.7372, longitude: 3.0865 },
  { city: "Tunis", country: "Tunisia", latitude: 36.8065, longitude: 10.1815 },
  { city: "Tripoli", country: "Libya", latitude: 32.8872, longitude: 13.1913 },
  { city: "Amman", country: "Jordan", latitude: 31.9539, longitude: 35.9106 },
  { city: "Beirut", country: "Lebanon", latitude: 33.8938, longitude: 35.5018 },
  { city: "Tbilisi", country: "Georgia", latitude: 41.6938, longitude: 44.8015 },
  { city: "Baku", country: "Azerbaijan", latitude: 40.4093, longitude: 49.8671 },
  { city: "Almaty", country: "Kazakhstan", latitude: 43.2551, longitude: 76.9126 },
  { city: "Kathmandu", country: "Nepal", latitude: 27.7172, longitude: 85.324 },
  { city: "Colombo", country: "Sri Lanka", latitude: 6.9271, longitude: 79.8612 },
  { city: "Dhaka", country: "Bangladesh", latitude: 23.8103, longitude: 90.4125 },
  { city: "Ulaanbaatar", country: "Mongolia", latitude: 47.8864, longitude: 106.9057 },
  { city: "Pyongyang", country: "North Korea", latitude: 39.0392, longitude: 125.7625 },
  { city: "Phnom Penh", country: "Cambodia", latitude: 11.5564, longitude: 104.9282 },
  { city: "Vientiane", country: "Laos", latitude: 17.9757, longitude: 102.6331 },
  { city: "Rangoon", country: "Myanmar", latitude: 16.8409, longitude: 96.1735 },
  { city: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { city: "Rome", country: "Italy", latitude: 41.9028, longitude: 12.4964 },
  { city: "Athens", country: "Greece", latitude: 37.9838, longitude: 23.7275 },
  { city: "Warsaw", country: "Poland", latitude: 52.2297, longitude: 21.0122 },
  { city: "Kyiv", country: "Ukraine", latitude: 50.4501, longitude: 30.5234 },
  { city: "Bucharest", country: "Romania", latitude: 44.4268, longitude: 26.1025 },
  { city: "Budapest", country: "Hungary", latitude: 47.4979, longitude: 19.0402 },
  { city: "Prague", country: "Czech Republic", latitude: 50.0755, longitude: 14.4378 },
  { city: "Vienna", country: "Austria", latitude: 48.2082, longitude: 16.3738 },
  { city: "Stockholm", country: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { city: "Oslo", country: "Norway", latitude: 59.9139, longitude: 10.7522 },
  { city: "Helsinki", country: "Finland", latitude: 60.1699, longitude: 24.9384 },
  { city: "Copenhagen", country: "Denmark", latitude: 55.6761, longitude: 12.5683 },
  { city: "Amsterdam", country: "Netherlands", latitude: 52.3676, longitude: 4.9041 },
  { city: "Brussels", country: "Belgium", latitude: 50.8503, longitude: 4.3517 },
  { city: "Zurich", country: "Switzerland", latitude: 47.3769, longitude: 8.5417 },
  { city: "Lisbon", country: "Portugal", latitude: 38.7223, longitude: -9.1393 },
  { city: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603 },
  { city: "Reykjavik", country: "Iceland", latitude: 64.1466, longitude: -21.9426 },
  { city: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832 },
  { city: "Chicago", country: "USA", latitude: 41.8781, longitude: -87.6298 },
  { city: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437 },
  { city: "Havana", country: "Cuba", latitude: 23.1136, longitude: -82.3666 },
  { city: "San José", country: "Costa Rica", latitude: 9.9281, longitude: -84.0907 },
  { city: "Caracas", country: "Venezuela", latitude: 10.4806, longitude: -66.9036 },
  { city: "Quito", country: "Ecuador", latitude: -0.1807, longitude: -78.4678 },
  { city: "La Paz", country: "Bolivia", latitude: -16.5, longitude: -68.15 },
  // Extra Africa
  { city: "Cape Town", country: "South Africa", latitude: -33.9249, longitude: 18.4241 },
  { city: "Durban", country: "South Africa", latitude: -29.8587, longitude: 31.0218 },
  { city: "Marrakech", country: "Morocco", latitude: 31.6295, longitude: -7.9811 },
  { city: "Dakar", country: "Senegal", latitude: 14.7167, longitude: -17.4677 },
  { city: "Bamako", country: "Mali", latitude: 12.6392, longitude: -8.0029 },
  { city: "Ouagadougou", country: "Burkina Faso", latitude: 12.3714, longitude: -1.5197 },
  { city: "Niamey", country: "Niger", latitude: 13.5127, longitude: 2.1128 },
  { city: "Douala", country: "Cameroon", latitude: 4.0511, longitude: 9.7679 },
  { city: "Libreville", country: "Gabon", latitude: 0.4162, longitude: 9.4673 },
  { city: "Brazzaville", country: "Congo", latitude: -4.2634, longitude: 15.2429 },
  { city: "Maputo", country: "Mozambique", latitude: -25.9692, longitude: 32.5732 },
  { city: "Harare", country: "Zimbabwe", latitude: -17.8252, longitude: 31.0335 },
  { city: "Lusaka", country: "Zambia", latitude: -15.3875, longitude: 28.3228 },
  { city: "Antananarivo", country: "Madagascar", latitude: -18.8792, longitude: 47.5079 },
  { city: "Windhoek", country: "Namibia", latitude: -22.5609, longitude: 17.0658 },
  { city: "Gaborone", country: "Botswana", latitude: -24.6282, longitude: 25.9231 },
  { city: "Freetown", country: "Sierra Leone", latitude: 8.4657, longitude: -13.2317 },
  { city: "Conakry", country: "Guinea", latitude: 9.6412, longitude: -13.5784 },
  { city: "Mogadishu", country: "Somalia", latitude: 2.0469, longitude: 45.3182 },
  { city: "Asmara", country: "Eritrea", latitude: 15.3229, longitude: 38.9251 },
  // Extra Europe
  { city: "Barcelona", country: "Spain", latitude: 41.3874, longitude: 2.1686 },
  { city: "Seville", country: "Spain", latitude: 37.3891, longitude: -5.9845 },
  { city: "Milan", country: "Italy", latitude: 45.4642, longitude: 9.19 },
  { city: "Naples", country: "Italy", latitude: 40.8518, longitude: 14.2681 },
  { city: "Florence", country: "Italy", latitude: 43.7696, longitude: 11.2558 },
  { city: "Munich", country: "Germany", latitude: 48.1351, longitude: 11.582 },
  { city: "Hamburg", country: "Germany", latitude: 53.5511, longitude: 9.9937 },
  { city: "Marseille", country: "France", latitude: 43.2965, longitude: 5.3698 },
  { city: "Lyon", country: "France", latitude: 45.764, longitude: 4.8357 },
  { city: "Edinburgh", country: "United Kingdom", latitude: 55.9533, longitude: -3.1883 },
  { city: "Manchester", country: "United Kingdom", latitude: 53.4808, longitude: -2.2426 },
  { city: "Antwerp", country: "Belgium", latitude: 51.2194, longitude: 4.4025 },
  { city: "Ghent", country: "Belgium", latitude: 51.0543, longitude: 3.7174 },
  { city: "Rotterdam", country: "Netherlands", latitude: 51.9225, longitude: 4.4792 },
  { city: "Krakow", country: "Poland", latitude: 50.0647, longitude: 19.945 },
  { city: "Bratislava", country: "Slovakia", latitude: 48.1486, longitude: 17.1077 },
  { city: "Ljubljana", country: "Slovenia", latitude: 46.0569, longitude: 14.5058 },
  { city: "Zagreb", country: "Croatia", latitude: 45.815, longitude: 15.9819 },
  { city: "Belgrade", country: "Serbia", latitude: 44.7866, longitude: 20.4489 },
  { city: "Sarajevo", country: "Bosnia", latitude: 43.8563, longitude: 18.4131 },
  { city: "Tallinn", country: "Estonia", latitude: 59.437, longitude: 24.7536 },
  { city: "Riga", country: "Latvia", latitude: 56.9496, longitude: 24.1052 },
  { city: "Vilnius", country: "Lithuania", latitude: 54.6872, longitude: 25.2797 },
  { city: "Porto", country: "Portugal", latitude: 41.1579, longitude: -8.6291 },
  { city: "Nice", country: "France", latitude: 43.7102, longitude: 7.262 },
  // Extra Americas
  { city: "Vancouver", country: "Canada", latitude: 49.2827, longitude: -123.1207 },
  { city: "Montreal", country: "Canada", latitude: 45.5017, longitude: -73.5673 },
  { city: "San Francisco", country: "USA", latitude: 37.7749, longitude: -122.4194 },
  { city: "Miami", country: "USA", latitude: 25.7617, longitude: -80.1918 },
  { city: "Houston", country: "USA", latitude: 29.7604, longitude: -95.3698 },
  { city: "Seattle", country: "USA", latitude: 47.6062, longitude: -122.3321 },
  { city: "Denver", country: "USA", latitude: 39.7392, longitude: -104.9903 },
  { city: "Washington DC", country: "USA", latitude: 38.9072, longitude: -77.0369 },
  { city: "Boston", country: "USA", latitude: 42.3601, longitude: -71.0589 },
  { city: "Guadalajara", country: "Mexico", latitude: 20.6597, longitude: -103.3496 },
  { city: "Monterrey", country: "Mexico", latitude: 25.6866, longitude: -100.3161 },
  { city: "Medellín", country: "Colombia", latitude: 6.2476, longitude: -75.5658 },
  { city: "Recife", country: "Brazil", latitude: -8.0476, longitude: -34.877 },
  { city: "Rio de Janeiro", country: "Brazil", latitude: -22.9068, longitude: -43.1729 },
  { city: "Montevideo", country: "Uruguay", latitude: -34.9011, longitude: -56.1645 },
  { city: "Asunción", country: "Paraguay", latitude: -25.2637, longitude: -57.5759 },
  { city: "Panama City", country: "Panama", latitude: 8.9824, longitude: -79.5199 },
  { city: "Guatemala City", country: "Guatemala", latitude: 14.6349, longitude: -90.5069 },
  { city: "Kingston", country: "Jamaica", latitude: 18.0179, longitude: -76.8099 },
  { city: "Port-au-Prince", country: "Haiti", latitude: 18.5944, longitude: -72.3074 },
  // Extra Asia & Oceania
  { city: "Kyoto", country: "Japan", latitude: 35.0116, longitude: 135.7681 },
  { city: "Sapporo", country: "Japan", latitude: 43.0618, longitude: 141.3545 },
  { city: "Busan", country: "South Korea", latitude: 35.1796, longitude: 129.0756 },
  { city: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737 },
  { city: "Hanoi", country: "Vietnam", latitude: 21.0278, longitude: 105.8342 },
  { city: "Bangalore", country: "India", latitude: 12.9716, longitude: 77.5946 },
  { city: "Delhi", country: "India", latitude: 28.7041, longitude: 77.1025 },
  { city: "Jaipur", country: "India", latitude: 26.9124, longitude: 75.7873 },
  { city: "Islamabad", country: "Pakistan", latitude: 33.6844, longitude: 73.0479 },
  { city: "Dubai", country: "UAE", latitude: 25.2048, longitude: 55.2708 },
  { city: "Doha", country: "Qatar", latitude: 25.2854, longitude: 51.531 },
  { city: "Muscat", country: "Oman", latitude: 23.588, longitude: 58.3829 },
  { city: "Perth", country: "Australia", latitude: -31.9505, longitude: 115.8605 },
  { city: "Brisbane", country: "Australia", latitude: -27.4698, longitude: 153.0251 },
  { city: "Wellington", country: "New Zealand", latitude: -41.2865, longitude: 174.7762 },
  { city: "Suva", country: "Fiji", latitude: -18.1416, longitude: 178.4419 },
  { city: "Noumea", country: "New Caledonia", latitude: -22.2558, longitude: 166.4505 },
];

const MESSAGES = [
  "Wish you were here!",
  "Greetings from afar!",
  "Sending love from this beautiful city.",
  "Having an amazing time here.",
  "The food here is incredible!",
  "Missing home but loving every moment.",
  "You'd love it here.",
  "The sunsets are breathtaking.",
  "So much history in every street.",
  "Can't wait to tell you all about this trip.",
];

const NAMES = [
  "Sophie", "Lucas", "Emma", "Liam", "Olivia",
  "Noah", "Ava", "Elijah", "Isabella", "James",
  "Mia", "Oliver", "Charlotte", "William", "Amelia",
  "Benjamin", "Harper", "Ethan", "Evelyn", "Sebastian",
];

async function seed() {
  // Clear existing postcards first
  console.log("Clearing existing postcards...");
  let cleared = 0;
  let cursor: string | null = null;
  do {
    const url: string = `${API_URL}/postcards?limit=50${cursor ? `&cursor=${cursor}` : ""}`;
    const { postcards, nextCursor }: { postcards: { id: string }[]; nextCursor: string | null } = await fetch(url).then((r) => r.json());
    for (const card of postcards) {
      await fetch(`${API_URL}/postcards/${card.id}`, { method: "DELETE" }).catch(() => {});
      cleared++;
    }
    cursor = nextCursor ?? null;
  } while (cursor);
  console.log(`Cleared ${cleared} postcards.`);

  // Download images to MinIO first
  console.log(`Uploading ${CITIES.length} images to MinIO...`);
  const imageKeys: string[] = [];
  for (let i = 0; i < CITIES.length; i++) {
    try {
      const key = await ensureImage(i);
      imageKeys.push(key);
      process.stdout.write(`\rImages: ${i + 1}/${CITIES.length}`);
    } catch (err) {
      console.error(`\nFailed to upload image ${i}:`, err);
      imageKeys.push(`seed/card-0.jpg`); // fallback to first image
    }
  }
  console.log("\nImages ready.");

  console.log(`Seeding ${CITIES.length} postcards to ${API_URL}...`);
  let created = 0;

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    const imageKey = imageKeys[i];
    const message = MESSAGES[i % MESSAGES.length];
    const senderName = NAMES[i % NAMES.length];

    try {
      const res = await fetch(`${API_URL}/postcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontImageKey: imageKey,
          message: `${message} — ${city.city}`,
          senderName,
          country: city.country,
          latitude: city.latitude,
          longitude: city.longitude,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`[${i + 1}] Failed ${city.city}: ${err}`);
      } else {
        created++;
        process.stdout.write(`\r${created}/${CITIES.length} created (${city.city})`);
      }
    } catch (err) {
      console.error(`[${i + 1}] Error for ${city.city}:`, err);
    }
  }

  console.log(`\nDone! ${created}/${CITIES.length} postcards seeded.`);
}

seed();
