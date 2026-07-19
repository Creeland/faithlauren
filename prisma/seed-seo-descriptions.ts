// Seed starting SEO descriptions for portfolio groups and portfolios.
// Only fills rows whose description is still empty, so it never overwrites
// copy authored in the admin. Safe to rerun.
// Run with: node --env-file=.env --import=tsx prisma/seed-seo-descriptions.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const groupDescriptions: Record<string, string> = {
  weddings:
    "Wedding photography in Wichita Falls, Texas and across North Texas. From getting ready to the last dance, Faith Lauren documents ceremonies, receptions, and elopements with a natural, storytelling approach, so every vow, tear, and toast is remembered the way it felt.",
  family:
    "Family photography in Wichita Falls, Texas. Relaxed sessions for families, kids, and pets, at home, outdoors, or wherever your crew feels most like themselves. Serving Wichita Falls and all of North Texas.",
  events:
    "Event photography in Wichita Falls, Texas. Faith Lauren covers concerts, parties, recitals, and community gatherings across North Texas, capturing candid moments and the atmosphere of the night as it happens.",
  portraits:
    "Portrait photography in Wichita Falls, Texas. Senior portraits, couples sessions, and professional headshots with a relaxed, unhurried feel, photographed on location around Wichita Falls and North Texas.",
  lifestyle:
    "Lifestyle photography rooted in Wichita Falls, Texas. From working ranches and agriculture to wildlife and destination travel, these sessions document real life and the landscapes of North Texas and beyond.",
  business:
    "Commercial and brand photography for businesses in Wichita Falls, Texas. Product photos, content for creators, and imagery for social media and advertising that helps North Texas businesses look as good as the work they do.",
};

const portfolioDescriptions: Record<string, string> = {
  // Weddings
  bridal:
    "Bridal portraits photographed in Wichita Falls and across North Texas. A dedicated session for the bride, her gown, and the details, captured before the big day or on the morning of.",
  good: "Groom portraits from weddings in Wichita Falls and North Texas. Getting-ready moments, first looks, and portraits that give the groom's side of the day its due.",
  "bride-groom":
    "Bride and groom portraits from North Texas weddings. Just-married sessions around Wichita Falls that capture the two of you in the first hours of marriage.",
  ceremony:
    "Wedding ceremony photography in Wichita Falls, Texas. Vows, ring exchanges, first kisses, and the faces of the people who came to watch, documented without interruption.",
  elopement:
    "Elopement photography by a Wichita Falls, Texas photographer. Small, intentional weddings documented start to finish, wherever you choose to say your vows, in North Texas or far beyond.",
  details:
    "Wedding detail photography from Wichita Falls, Texas weddings: rings, gowns, florals, invitations, and tablescapes, styled and photographed before the day sweeps them up.",
  // Family
  family:
    "Family portrait sessions in Wichita Falls, Texas. Posed just enough, with plenty of room for the in-between moments that show how your family actually is.",
  pets: "Pet photography in Wichita Falls, Texas. Portraits of dogs, cats, horses, and the rest of the family's four-legged members, at home or out in the North Texas landscape.",
  candid:
    "Candid family photography in Wichita Falls, Texas. Unposed, documentary-style sessions that follow real moments instead of staging them.",
  // Events
  music:
    "Live music photography in Wichita Falls, Texas. Concerts, gigs, and performances across North Texas, shot in the moment with the energy of the stage intact.",
  recitals:
    "Recital photography in Wichita Falls, Texas. Dance recitals, music performances, and school productions, with performers captured mid-moment from the audience's best seat.",
  parties:
    "Party and celebration photography in Wichita Falls, Texas. Birthdays, showers, and get-togethers across North Texas, documented so the host gets to be in the memories too.",
  // Portraits
  senior:
    "Senior portrait photography in Wichita Falls, Texas. Sessions built around each senior's personality, with locations around Wichita Falls and North Texas to match.",
  business:
    "Professional headshots and business portraits in Wichita Falls, Texas. Clean, approachable portraits for LinkedIn, company sites, and personal brands across North Texas.",
  couples:
    "Couples photography in Wichita Falls, Texas. Engagement sessions, anniversaries, and just-because portraits for couples across North Texas.",
  // Lifestyle
  agriculture:
    "Agricultural photography in Wichita Falls, Texas. Farms, ranches, livestock, and the working land of North Texas, photographed with the respect the work deserves.",
  "wild-life":
    "Wildlife photography from Wichita Falls, Texas and the surrounding North Texas countryside. Birds, deer, and the region's quieter residents, photographed in their element.",
  destination:
    "Destination photography by a Wichita Falls, Texas based photographer. Travel sessions and landscapes from wherever the road leads, brought home to North Texas.",
  // Professional
  creators:
    "Content photography for creators, based in Wichita Falls, Texas. Portraits and lifestyle imagery that give musicians, makers, and influencers a library of professional visuals.",
  "social-media-and-advertising":
    "Social media and advertising photography in Wichita Falls, Texas. Scroll-stopping imagery made for feeds, campaigns, and North Texas businesses that need content that connects.",
  "product-photography":
    "Product photography in Wichita Falls, Texas. Clean, styled product images for e-commerce, menus, and marketing, shot for North Texas makers and businesses.",
};

async function main() {
  let updated = 0;

  for (const [slug, description] of Object.entries(groupDescriptions)) {
    const result = await client.execute({
      sql: `UPDATE "PortfolioGroup" SET "description" = ?
            WHERE "slug" = ? AND ("description" IS NULL OR "description" = '')`,
      args: [description, slug],
    });
    if (result.rowsAffected > 0) {
      console.log(`group ${slug}: seeded`);
      updated += result.rowsAffected;
    } else {
      console.log(`group ${slug}: skipped (missing or already has copy)`);
    }
  }

  for (const [slug, description] of Object.entries(portfolioDescriptions)) {
    const result = await client.execute({
      sql: `UPDATE "Portfolio" SET "description" = ?
            WHERE "slug" = ? AND ("description" IS NULL OR "description" = '')`,
      args: [description, slug],
    });
    if (result.rowsAffected > 0) {
      console.log(`portfolio ${slug}: seeded`);
      updated += result.rowsAffected;
    } else {
      console.log(`portfolio ${slug}: skipped (missing or already has copy)`);
    }
  }

  console.log(`Done: ${updated} descriptions seeded.`);
}

main()
  .then(() => client.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
