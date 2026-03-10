/**
 * Seeds the database with initial data:
 * - Default branches (Nairobi, Meru, Nakuru, Kisumu)
 * - Default admin user
 * - Sample loan products
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Branches ─────────────────────────────────────────────────────────────
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { code: 'NBO' },
      update: {},
      create: { name: 'Nairobi Head Office', code: 'NBO', county: 'Nairobi', address: 'Upper Hill, Nairobi', latitude: -1.2921, longitude: 36.8219 },
    }),
    prisma.branch.upsert({
      where: { code: 'MER' },
      update: {},
      create: { name: 'Meru Branch', code: 'MER', county: 'Meru', address: 'Meru Town, Meru', latitude: 0.0500, longitude: 37.6494 },
    }),
    prisma.branch.upsert({
      where: { code: 'NAK' },
      update: {},
      create: { name: 'Nakuru Branch', code: 'NAK', county: 'Nakuru', address: 'Section 58, Nakuru', latitude: -0.3031, longitude: 36.0800 },
    }),
    prisma.branch.upsert({
      where: { code: 'KSM' },
      update: {},
      create: { name: 'Kisumu Branch', code: 'KSM', county: 'Kisumu', address: 'Oginga Odinga St, Kisumu', latitude: -0.1022, longitude: 34.7617 },
    }),
    prisma.branch.upsert({
      where: { code: 'ELD' },
      update: {},
      create: { name: 'Eldoret Branch', code: 'ELD', county: 'Uasin Gishu', address: 'Uganda Rd, Eldoret', latitude: 0.5143, longitude: 35.2698 },
    }),
  ]);

  console.log(`Created ${branches.length} branches`);

  // ── Admin User ────────────────────────────────────────────────────────────
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@Juhudi2024!';
  const adminHash = await bcrypt.hash(adminPass, 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@juhudikilimo.co.ke' },
    update: {},
    create: {
      email: 'admin@juhudikilimo.co.ke',
      passwordHash: adminHash,
      role: 'ADMIN',
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+254700000000',
      employeeId: 'JK-ADMIN-001',
      branchId: branches[0].id,
      mustChangePass: true,
    },
  });
  console.log(`Admin user: ${admin.email} (change password on first login)`);

  // ── Loan Products ─────────────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.loanProduct.upsert({
      where: { code: 'AGRI-MICRO' },
      update: {},
      create: {
        name: 'Agricultural Micro Loan',
        code: 'AGRI-MICRO',
        description: 'For purchase of Yara inputs (seeds, fertilizer, crop protection)',
        minAmountKes: 5_000,
        maxAmountKes: 50_000,
        minTermMonths: 3,
        maxTermMonths: 6,
        nominalInterestRate: 18,
        processingFeePct: 2,
      },
    }),
    prisma.loanProduct.upsert({
      where: { code: 'AGRI-SME' },
      update: {},
      create: {
        name: 'Agricultural SME Loan',
        code: 'AGRI-SME',
        description: 'For medium-scale farm investment and working capital',
        minAmountKes: 50_001,
        maxAmountKes: 500_000,
        minTermMonths: 6,
        maxTermMonths: 24,
        nominalInterestRate: 16,
        processingFeePct: 2,
      },
    }),
    prisma.loanProduct.upsert({
      where: { code: 'INPUT-CREDIT' },
      update: {},
      create: {
        name: 'Yara Input Credit',
        code: 'INPUT-CREDIT',
        description: 'Specific to Yara product purchases; repaid after harvest',
        minAmountKes: 3_000,
        maxAmountKes: 100_000,
        minTermMonths: 3,
        maxTermMonths: 9,
        nominalInterestRate: 15,
        processingFeePct: 1,
      },
    }),
  ]);

  console.log(`Created ${products.length} loan products`);

  // ── ILP Loan Products ─────────────────────────────────────────────────────
  const ilpProducts = await Promise.all([
    prisma.loanProduct.upsert({
      where: { code: 'ILP-FARM' },
      update: {},
      create: {
        name: 'ILP Farmer',
        code: 'ILP-FARM',
        description: 'Individual Loan Product for graduating large-scale farmers. Covers farm investment, equipment, and working capital.',
        minAmountKes: 100_000,
        maxAmountKes: 500_000,
        minTermMonths: 6,
        maxTermMonths: 24,
        nominalInterestRate: 18,
        processingFeePct: 2,
      },
    }),
    prisma.loanProduct.upsert({
      where: { code: 'ILP-LAND' },
      update: {},
      create: {
        name: 'ILP Landlord',
        code: 'ILP-LAND',
        description: 'Individual Loan Product for urban/peri-urban rental property owners. Covers construction, renovation, and property acquisition.',
        minAmountKes: 200_000,
        maxAmountKes: 1_000_000,
        minTermMonths: 6,
        maxTermMonths: 36,
        nominalInterestRate: 17,
        processingFeePct: 2,
      },
    }),
    prisma.loanProduct.upsert({
      where: { code: 'ILP-SHOP' },
      update: {},
      create: {
        name: 'ILP Shop Owner',
        code: 'ILP-SHOP',
        description: 'Individual Loan Product for retail business owners. Covers stock purchase, equipment, and business expansion.',
        minAmountKes: 100_000,
        maxAmountKes: 500_000,
        minTermMonths: 6,
        maxTermMonths: 24,
        nominalInterestRate: 18,
        processingFeePct: 2,
      },
    }),
  ]);

  console.log(`Created ${ilpProducts.length} ILP loan products (${ilpProducts.map(p => p.code).join(', ')})`);
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
