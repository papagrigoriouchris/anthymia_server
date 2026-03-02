import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
    {
        name: "Θυμαρίσιο Μέλι",
        description:
            "Αγνό θυμαρίσιο μέλι από τα βουνά της Κρήτης. Πλούσια, έντονη γεύση με αρωματικές νότες θυμαριού. Ιδανικό για τσάι, γιαούρτι και γλυκά.",
        price: 12.5,
        image: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=600",
        category: "Κλασικά",
        weight: "450g",
        featured: true,
    },
    {
        name: "Ανθόμελο",
        description:
            "Πολυανθικό μέλι από τα λιβάδια της Μακεδονίας. Λεπτή, λουλουδάτη γεύση με golden απόχρωση. Τέλειο για κάθε μέρα.",
        price: 9.9,
        image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?q=80&w=600",
        category: "Κλασικά",
        weight: "450g",
        featured: true,
    },
    {
        name: "Πευκόμελο",
        description:
            "Σπάνιο πευκόμελο από τα δάση της Θάσου. Σκούρο, πλούσιο, με μεταλλικές νότες και χαμηλότερη γλυκύτητα. Εξαιρετικά θρεπτικό.",
        price: 14.0,
        image: "https://images.unsplash.com/photo-1471943311424-646960669fbc?q=80&w=600",
        category: "Premium",
        weight: "450g",
        featured: true,
    },
    {
        name: "Ελατίσιο Μέλι",
        description:
            "Ελατίσιο μέλι από τα έλατα του Μαινάλου. Σκούρο χρώμα, βαριά υφή, πλούσιο σε μέταλλα και αντιοξειδωτικά.",
        price: 16.0,
        image: "https://images.unsplash.com/photo-1558642452-92a1068bd86d?q=80&w=600",
        category: "Premium",
        weight: "450g",
        featured: false,
    },
    {
        name: "Ερεικόμελο",
        description:
            "Μέλι ερείκης από τα υψίπεδα της Πίνδου. Σκούρο καστανό χρώμα, κρεμώδης υφή, πλούσια αρωματική γεύση.",
        price: 13.5,
        image: "https://images.unsplash.com/photo-1558642452-b85672322d7a?q=80&w=600",
        category: "Σπάνια",
        weight: "350g",
        featured: false,
    },
    {
        name: "Μέλι Βελανιδιάς",
        description:
            "Μέλι βελανιδιάς από τα δρυοδάση της Ηπείρου. Σκούρο, με ξυλώδεις νότες και εξαιρετικές αντιβακτηριδιακές ιδιότητες.",
        price: 15.0,
        image: "https://images.unsplash.com/photo-1445582352853-2713f0195ad5?q=80&w=600",
        category: "Σπάνια",
        weight: "350g",
        featured: false,
    },
];

async function main() {
    console.log("🌱 Seeding database...");

    // Clear existing products
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    // Create products with categories
    for (const product of products) {
        const { category, ...productData } = product;
        await prisma.product.create({
            data: {
                ...productData,
                category: {
                    connectOrCreate: {
                        where: { name: category },
                        create: { name: category }
                    }
                }
            }
        });
    }

    console.log(`✅ Seeded ${products.length} products`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
