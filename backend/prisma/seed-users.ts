/**
 * Seed additional test users for all roles.
 * Run: npx tsx prisma/seed-users.ts
 *
 * Users created:
 *  ADMIN            – admin@juhudikilimo.co.ke        (already exists from seed.ts)
 *  BRANCH_MANAGER   – manager.nairobi@juhudikilimo.co.ke
 *  BRANCH_MANAGER   – manager.meru@juhudikilimo.co.ke
 *  SUPERVISOR       – supervisor.nairobi@juhudikilimo.co.ke
 *  SUPERVISOR       – supervisor.meru@juhudikilimo.co.ke
 *  LOAN_OFFICER     – officer.wanjiku@juhudikilimo.co.ke
 *  LOAN_OFFICER     – officer.kamau@juhudikilimo.co.ke
 *  LOAN_OFFICER     – officer.otieno@juhudikilimo.co.ke
 *  LOAN_OFFICER     – officer.cheptoo@juhudikilimo.co.ke  (Eldoret)
 *  LOAN_OFFICER     – officer.mwangi@juhudikilimo.co.ke   (Nakuru)
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface UserDef {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  branchCode: string;
  employeeId: string;
  tempPassword: string;
}

const USERS: UserDef[] = [
  // ── Branch Managers ──────────────────────────────────────────────────────
  {
    email: 'manager.nairobi@juhudikilimo.co.ke',
    firstName: 'Grace',
    lastName: 'Wambui',
    phone: '+254711000001',
    role: 'BRANCH_MANAGER',
    branchCode: 'NBO',
    employeeId: 'JK-MGR-NBO-001',
    tempPassword: 'Manager@Juhudi1!',
  },
  {
    email: 'manager.meru@juhudikilimo.co.ke',
    firstName: 'James',
    lastName: 'Muriithi',
    phone: '+254711000002',
    role: 'BRANCH_MANAGER',
    branchCode: 'MER',
    employeeId: 'JK-MGR-MER-001',
    tempPassword: 'Manager@Juhudi2!',
  },

  // ── Supervisors ──────────────────────────────────────────────────────────
  {
    email: 'supervisor.nairobi@juhudikilimo.co.ke',
    firstName: 'Peter',
    lastName: 'Njoroge',
    phone: '+254722000001',
    role: 'SUPERVISOR',
    branchCode: 'NBO',
    employeeId: 'JK-SUP-NBO-001',
    tempPassword: 'Supervisor@Juhudi1!',
  },
  {
    email: 'supervisor.meru@juhudikilimo.co.ke',
    firstName: 'Faith',
    lastName: 'Muthoni',
    phone: '+254722000002',
    role: 'SUPERVISOR',
    branchCode: 'MER',
    employeeId: 'JK-SUP-MER-001',
    tempPassword: 'Supervisor@Juhudi2!',
  },
  {
    email: 'supervisor.kisumu@juhudikilimo.co.ke',
    firstName: 'Achieng',
    lastName: 'Otieno',
    phone: '+254722000003',
    role: 'SUPERVISOR',
    branchCode: 'KSM',
    employeeId: 'JK-SUP-KSM-001',
    tempPassword: 'Supervisor@Juhudi3!',
  },

  // ── Loan Officers ────────────────────────────────────────────────────────
  {
    email: 'officer.wanjiku@juhudikilimo.co.ke',
    firstName: 'Mary',
    lastName: 'Wanjiku',
    phone: '+254733000001',
    role: 'LOAN_OFFICER',
    branchCode: 'NBO',
    employeeId: 'JK-LO-NBO-001',
    tempPassword: 'Officer@Juhudi1!',
  },
  {
    email: 'officer.kamau@juhudikilimo.co.ke',
    firstName: 'John',
    lastName: 'Kamau',
    phone: '+254733000002',
    role: 'LOAN_OFFICER',
    branchCode: 'MER',
    employeeId: 'JK-LO-MER-001',
    tempPassword: 'Officer@Juhudi2!',
  },
  {
    email: 'officer.otieno@juhudikilimo.co.ke',
    firstName: 'David',
    lastName: 'Otieno',
    phone: '+254733000003',
    role: 'LOAN_OFFICER',
    branchCode: 'KSM',
    employeeId: 'JK-LO-KSM-001',
    tempPassword: 'Officer@Juhudi3!',
  },
  {
    email: 'officer.cheptoo@juhudikilimo.co.ke',
    firstName: 'Esther',
    lastName: 'Cheptoo',
    phone: '+254733000004',
    role: 'LOAN_OFFICER',
    branchCode: 'ELD',
    employeeId: 'JK-LO-ELD-001',
    tempPassword: 'Officer@Juhudi4!',
  },
  {
    email: 'officer.mwangi@juhudikilimo.co.ke',
    firstName: 'Samuel',
    lastName: 'Mwangi',
    phone: '+254733000005',
    role: 'LOAN_OFFICER',
    branchCode: 'NAK',
    employeeId: 'JK-LO-NAK-001',
    tempPassword: 'Officer@Juhudi5!',
  },
];

async function main() {
  console.log('Seeding test users...\n');

  // Fetch all branches
  const branches = await prisma.branch.findMany({ select: { id: true, code: true, name: true } });
  const branchMap = Object.fromEntries(branches.map(b => [b.code, b]));

  const results: Array<{ email: string; role: string; branch: string; password: string; status: string }> = [];

  for (const def of USERS) {
    const branch = branchMap[def.branchCode];
    if (!branch) {
      console.error(`  ❌ Branch not found: ${def.branchCode}`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: def.email } });
    if (existing) {
      results.push({ email: def.email, role: def.role, branch: branch.name, password: def.tempPassword, status: 'already exists' });
      continue;
    }

    const passwordHash = await bcrypt.hash(def.tempPassword, 12);
    await prisma.user.create({
      data: {
        email: def.email,
        firstName: def.firstName,
        lastName: def.lastName,
        phone: def.phone,
        role: def.role,
        branchId: branch.id,
        employeeId: def.employeeId,
        passwordHash,
        mustChangePass: true,
        isActive: true,
      },
    });

    results.push({ email: def.email, role: def.role, branch: branch.name, password: def.tempPassword, status: 'created' });
  }

  // Pretty-print results table
  console.log('┌─────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│  ROLE             │ EMAIL                                         │ TEMP PASSWORD        │');
  console.log('├─────────────────────────────────────────────────────────────────────────────────────────┤');
  for (const r of results) {
    const role   = r.role.padEnd(18);
    const email  = r.email.padEnd(45);
    const pass   = r.password.padEnd(22);
    const flag   = r.status === 'already exists' ? ' (exists)' : ' ✓ created';
    console.log(`│  ${role}│ ${email}│ ${pass}│${flag}`);
  }
  console.log('└─────────────────────────────────────────────────────────────────────────────────────────┘');
  console.log('\n⚠️  All users must change their password on first login.');
  console.log('   Users are assigned to specific branches – loan officers only see their branch\'s customers.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
