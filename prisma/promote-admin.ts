
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error("Please provide an email address.");
        console.error("Usage: npx tsx prisma/promote-admin.ts <email>");
        process.exit(1);
    }

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: "ADMIN" },
        });
        console.log(`✅ Successfully promoted ${user.email} to ADMIN.`);
    } catch (error) {
        console.error(`❌ Failed to find or update user with email: ${email}`);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
