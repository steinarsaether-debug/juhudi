/**
 * Seed script: import Juhudi branches, loan officers and groups from Excel export.
 * Run with:  npx ts-node --transpile-only prisma/seed-excel.ts
 *
 * Default password for all generated LO accounts: Juhudi2025!
 * All accounts have mustChangePass = true so LOs are forced to set their own password on first login.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BranchData {
  name:    string;
  code:    string;
  county:  string;
  region:  string;
  address: string;
}
interface LOData {
  firstName:  string;
  lastName:   string;
  email:      string;
  branchName: string;
  phone:      string;
}
interface GroupData {
  registrationNo: string;
  name:           string;
  branchName:     string;
  loName:         string;
}
interface SeedData {
  branches:      BranchData[];
  loanOfficers:  LOData[];
  groups:        GroupData[];
}

async function main() {
  const dataPath = path.join(__dirname, 'seed-excel-data.json');
  const seed: SeedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`\nLoaded: ${seed.branches.length} branches, ${seed.loanOfficers.length} LOs, ${seed.groups.length} groups`);

  const defaultPassword = await bcrypt.hash('Juhudi2025!', 10);

  // ── 1. Upsert Branches ───────────────────────────────────────────────────────
  console.log('\n[1/3] Upserting branches…');
  const branchIdMap: Record<string, string> = {}; // name → id

  for (const b of seed.branches) {
    const branch = await prisma.branch.upsert({
      where:  { code: b.code },
      update: { name: b.name, county: b.county, address: b.address },
      create: { name: b.name, code: b.code, county: b.county, address: b.address },
    });
    branchIdMap[b.name] = branch.id;
  }
  console.log(`  ✓ ${Object.keys(branchIdMap).length} branches ready`);

  // ── 2. Upsert Loan Officers ──────────────────────────────────────────────────
  console.log('\n[2/3] Upserting loan officers…');
  const loIdMap: Record<string, string> = {}; // full name → id
  let loCreated = 0, loSkipped = 0;

  for (const lo of seed.loanOfficers) {
    const branchId = branchIdMap[lo.branchName];
    if (!branchId) {
      console.warn(`  ⚠ Branch not found for LO "${lo.firstName} ${lo.lastName}": ${lo.branchName}`);
      loSkipped++;
      continue;
    }
    try {
      const user = await prisma.user.upsert({
        where:  { email: lo.email },
        update: { branchId, firstName: lo.firstName, lastName: lo.lastName },
        create: {
          email:         lo.email,
          passwordHash:  defaultPassword,
          role:          'LOAN_OFFICER',
          firstName:     lo.firstName,
          lastName:      lo.lastName,
          phone:         lo.phone,
          branchId,
          mustChangePass: true,
        },
      });
      loIdMap[`${lo.firstName} ${lo.lastName}`.trim()] = user.id;
      // Also map by just firstName in case Excel name doesn't exactly match
      loCreated++;
    } catch (err) {
      console.warn(`  ⚠ Failed to upsert LO "${lo.email}":`, (err as Error).message);
      loSkipped++;
    }
  }
  console.log(`  ✓ ${loCreated} LOs upserted, ${loSkipped} skipped`);

  // Build a flexible name-lookup (normalised) for group → LO matching
  const loNameNormalised: Record<string, string> = {}; // normalised → id
  for (const [fullName, id] of Object.entries(loIdMap)) {
    loNameNormalised[fullName.toLowerCase().trim()] = id;
  }

  // ── 3. Create Loan Groups ────────────────────────────────────────────────────
  console.log('\n[3/3] Creating loan groups…');

  // Fetch existing registration numbers to avoid duplicates
  const existingCodes = new Set(
    (await prisma.loanGroup.findMany({ select: { registrationNo: true } }))
      .map(g => g.registrationNo)
      .filter(Boolean),
  );
  console.log(`  Existing groups in DB: ${existingCodes.size}`);

  let grpCreated = 0, grpSkipped = 0, grpMissing = 0;
  const BATCH = 100;
  const toCreate = seed.groups.filter((g: GroupData) => !existingCodes.has(g.registrationNo));
  console.log(`  New groups to insert: ${toCreate.length}`);

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH);
    const data = chunk
      .map((g: GroupData) => {
        const branchId = branchIdMap[g.branchName];
        const loId     = loNameNormalised[g.loName.toLowerCase().trim()];
        if (!branchId || !loId) { grpMissing++; return null; }
        return {
          name:             g.name,
          registrationNo:   g.registrationNo,
          branchId,
          loanOfficerId:    loId,
          status:           'ACTIVE' as const,
          meetingFrequency: 'MONTHLY' as const,
          formedAt:         new Date('2020-01-01'),
          isActive:         true,
        };
      })
      .filter(Boolean) as object[];

    if (data.length > 0) {
      const result = await prisma.loanGroup.createMany({ data, skipDuplicates: true });
      grpCreated += result.count;
    }
    grpSkipped += chunk.length - data.length;

    const done = Math.min(i + BATCH, toCreate.length);
    process.stdout.write(`\r  ${done}/${toCreate.length} processed…`);
  }
  console.log(`\n  ✓ ${grpCreated} groups created, ${existingCodes.size} already existed, ${grpMissing} skipped (missing branch/LO)`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.branch.count(),
    prisma.user.count({ where: { role: 'LOAN_OFFICER' } }),
    prisma.loanGroup.count(),
  ]);
  console.log('\n── Database totals after seed ──────────────────────────────');
  console.log(`  Branches:      ${counts[0]}`);
  console.log(`  Loan Officers: ${counts[1]}`);
  console.log(`  Loan Groups:   ${counts[2]}`);
  console.log('\n  Default password: Juhudi2025! (all LOs must change on first login)\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
