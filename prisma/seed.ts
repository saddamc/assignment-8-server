/**
 * Seed script to create the initial super-admin account.
 * Run once: npx ts-node --transpile-only prisma/seed.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@gmail.com';
    const password = '123456';
    const name = 'Super Admin';
    const contactNumber = '+1234567890';

    // Check if admin already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`✓ Admin user already exists: ${email}`);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
        await tx.user.create({
            data: {
                email,
                password: hashedPassword,
                role: UserRole.ADMIN,
            },
        });

        await tx.admin.create({
            data: {
                name,
                email,
                contactNumber,
            },
        });
    });

    console.log('✅ Admin created successfully!');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log('   ⚠️  Change the password after first login!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
