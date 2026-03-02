import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const samplePosts = [
    {
        title: "The Health Benefits of Raw Honey",
        slug: "health-benefits-of-raw-honey",
        content: `
<h2>Raw Honey: Nature's Liquid Gold</h2>
<p>For centuries, raw honey has been revered not just as a natural sweetener, but as a potent medicinal remedy. Unlike processed honey found in most supermarkets, raw honey is unpasteurized and unfiltered, preserving its natural enzymes, vitamins, and antioxidants.</p>
<h3>1. Rich in Antioxidants</h3>
<p>Raw honey contains a variety of antioxidants, including flavonoids and phenolic acids. These compounds help neutralize free radicals in the body, which are linked to chronic illnesses and aging.</p>
<h3>2. Antibacterial and Antifungal Properties</h3>
<p>Hydrogen peroxide is naturally produced in honey, giving it strong antibacterial properties. Manuka honey, in particular, is famous for its non-peroxide antibacterial activity, making it excellent for wound healing.</p>
<h3>3. Soothes Sore Throats</h3>
<p>A classic remedy, a spoonful of raw honey can effectively soothe an irritated throat and reduce coughing, sometimes more effectively than over-the-counter cough syrups.</p>
<p>Next time you enjoy a spoonful of our Anthymia honey, remember that you're not just satisfying your sweet tooth, but also giving your body a natural boost!</p>
        `,
        excerpt: "Discover the amazing health benefits of incorporating raw, unfiltered honey into your daily routine, from boosting immunity to soothing sore throats.",
        author: "Maria",
        featuredImage: "https://images.unsplash.com/photo-1587049352847-81a56d773c1c?w=800&q=80",
        category: "Health & Wellness",
        tags: ["Raw Honey", "Health", "Natural Remedies"],
        isPublished: true,
        seoTitle: "Health Benefits of Raw Honey | Anthymia",
        seoDescription: "Learn about the powerful health benefits of raw, unfiltered honey. Rich in antioxidants and natural enzymes."
    },
    {
        title: "How to Store Your Honey Properly",
        slug: "how-to-store-your-honey-properly",
        content: `
<h2>Keep Your Honey Fresh Forever</h2>
<p>Did you know that honey doesn't spoil? Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible! However, poor storage can affect its flavor, texture, and color.</p>
<h3>The Ideal Storage Conditions</h3>
<ul>
    <li><strong>Temperature is Key:</strong> Store honey at room temperature. Avoid keeping it near heat sources like stoves or sunny windows.</li>
    <li><strong>Keep it Airtight:</strong> Always seal the jar tightly after use. Honey naturally absorbs moisture from the air, which can cause fermentation.</li>
    <li><strong>No Refrigeration Needed:</strong> Don't put honey in the fridge. Cold temperatures simply speed up the crystallization process.</li>
</ul>
<h3>What About Crystallization?</h3>
<p>Crystallization is completely natural and a sign of pure, raw honey. If your honey crystallizes, simply place the jar in a bowl of warm water and stir gently until the crystals melt back into liquid form. Never microwave honey, as the intense heat destroys beneficial enzymes.</p>
        `,
        excerpt: "Learn the best practices for storing your pure honey to prevent crystallization and maintain its exceptional flavor for years to come.",
        author: "Nikos",
        featuredImage: "https://images.unsplash.com/photo-1554522437-12fc05d6e2e9?w=800&q=80",
        category: "Tips & Guides",
        tags: ["Storage", "Tips", "Crystallization"],
        isPublished: true,
        seoTitle: "How to Store Honey Properly | Anthymia",
        seoDescription: "A complete guide on how to store honey to preserve flavor and prevent premature crystallization."
    },
    {
        title: "The Journey from Hive to Jar",
        slug: "the-journey-from-hive-to-jar",
        content: `
<h2>Behind the Scenes of Anthymia Honey</h2>
<p>Have you ever wondered how the honey gets from our buzzing hives into the beautiful jars you receive? The process requires patience, care, and a deep respect for the bees.</p>
<h3>1. The Foraging</h3>
<p>It all starts with the bees. Our hives are placed in carefully selected locations across Greece—from the thyme-covered hillsides to deep pine forests. The worker bees travel miles every day, collecting nectar and bringing it back to the hive.</p>
<h3>2. The Harvesting</h3>
<p>We only harvest the surplus honey, ensuring the colony has enough food to survive the winter. Using traditional methods and minimal smoke, we gently remove the frames from the supers.</p>
<h3>3. Extraction and Settling</h3>
<p>The wax cappings are sliced off the honeycomb, and the frames are spun in a centrifuge to extract the liquid gold. The honey is then strained gently to remove large wax particles, but never micro-filtered. This is why you might find microscopic specks of pollen in our honey—a hallmark of its raw nature.</p>
<p>Finally, the honey rests in settling tanks before being poured straight into your jars. Unheated, unprocessed, and unforgettable.</p>
        `,
        excerpt: "Take a peek behind the scenes and discover the traditional, raw extraction process that brings Anthymia honey from the Greek mountains to your table.",
        author: "Katerina",
        featuredImage: "https://images.unsplash.com/photo-1587049449339-b9d9c22edeb1?w=800&q=80",
        category: "Our Story",
        tags: ["Beekeeping", "Tradition", "Harvest"],
        isPublished: true,
        seoTitle: "From Hive to Jar: Our Process | Anthymia",
        seoDescription: "Discover how Anthymia harvests its premium Greek honey using traditional, ethical beekeeping methods."
    },
    {
        title: "5 Delicious Ways to Use Thyme Honey",
        slug: "5-delicious-ways-to-use-thyme-honey",
        content: `
<h2>Beyond the Teacup: Culinary Uses for Thyme Honey</h2>
<p>Greek Thyme honey is world-renowned for its strong, aromatic flavor profile. While it's perfect stirred into tea or slathered on toast, its bold taste lends itself beautifully to both sweet and savory dishes.</p>
<h3>1. Drizzled Over Feta or Goat Cheese</h3>
<p>The contrast between salty, tangy cheese and sweet, aromatic thyme honey is an absolute revelation. Serve it alongside some walnuts for a quick, elegant appetizer.</p>
<h3>2. Honey Lemon Marinades</h3>
<p>Whisk thyme honey with olive oil, lemon juice, garlic, and wild thyme. It makes a fantastic marinade for chicken or pork before roasting.</p>
<h3>3. Greek Yogurt and Walnuts</h3>
<p>The absolute classic. A bowl of thick, full-fat Greek yogurt topped with crushed walnuts and a generous drizzle of thyme honey is the ultimate healthy breakfast or dessert.</p>
<h3>4. Glazed Root Vegetables</h3>
<p>Toss carrots or sweet potatoes in olive oil and roast them. Right before they finish, brush them with slightly warmed thyme honey.</p>
<h3>5. Homemade Salad Dressing</h3>
<p>Combine thyme honey with balsamic vinegar, olive oil, Dijon mustard, and salt. It elevates a simple green salad instantly.</p>
        `,
        excerpt: "Explore five creative and mouth-watering ways to elevate your everyday meals using the bold and aromatic flavor of Greek thyme honey.",
        author: "Maria",
        category: "Recipes",
        tags: ["Recipes", "Thyme Honey", "Cooking"],
        isPublished: true,
        seoTitle: "5 Ways to Use Thyme Honey | Anthymia",
        seoDescription: "Creative culinary ideas and recipes using Greek Thyme honey for sweet and savory dishes."
    }
];

async function main() {
    console.log("Seeding blog posts...");

    // Create each post ensuring slug uniqueness
    for (const post of samplePosts) {
        const existing = await prisma.post.findUnique({
            where: { slug: post.slug }
        });

        if (!existing) {
            await prisma.post.create({
                data: {
                    ...post,
                    publishedAt: new Date()
                }
            });
            console.log(`Created post: ${post.title}`);
        } else {
            console.log(`Post already exists: ${post.title}`);
        }
    }

    console.log("Blog seeding completed!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
