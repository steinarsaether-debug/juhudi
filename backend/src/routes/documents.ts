import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../config/database';
import { encrypt, decrypt } from '../services/encryption';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { config, ALLOWED_MIME_TYPES } from '../config';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(config.UPLOAD_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    // Store with random UUID name, not original name (security)
    cb(null, `${crypto.randomUUID()}.enc`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, `File type ${file.mimetype} not allowed`) as unknown as null, false);
    }
  },
});

router.post('/customers/:customerId', upload.single('document'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!req.file) throw new AppError(400, 'No file uploaded');

  const typeSchema = ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'KRA_PIN',
    'PASSPORT_PHOTO', 'PROOF_OF_RESIDENCE', 'FARM_OWNERSHIP_PROOF',
    'GROUP_MEMBERSHIP_CERT', 'BANK_STATEMENT', 'MPESA_STATEMENT', 'OTHER'];

  const docType = req.body.type;
  if (!typeSchema.includes(docType)) throw new AppError(400, 'Invalid document type');

  const customer = await prisma.customer.findUnique({ where: { id: req.params.customerId } });
  if (!customer) throw new AppError(404, 'Customer not found');

  // Compute checksum
  const fileBuffer = fs.readFileSync(req.file.path);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Encrypt the stored path
  const encryptedPath = encrypt(req.file.path);

  const doc = await prisma.kYCDocument.create({
    data: {
      customerId: req.params.customerId,
      type: docType,
      filePathEnc: encryptedPath,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      checksum,
    },
    select: { id: true, type: true, fileName: true, uploadedAt: true },
  });

  // Update KYC status to SUBMITTED if still PENDING
  if (customer.kycStatus === 'PENDING') {
    await prisma.customer.update({
      where: { id: req.params.customerId },
      data: { kycStatus: 'SUBMITTED' },
    });
  }

  await writeAuditLog(req.user.sub, 'UPLOAD_KYC_DOCUMENT', 'kyc_documents', doc.id, req);
  res.status(201).json(doc);
}));

// Serve document (authenticated, audit-logged)
router.get('/:documentId', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const doc = await prisma.kYCDocument.findUnique({ where: { id: req.params.documentId } });
  if (!doc) throw new AppError(404, 'Document not found');

  const filePath = decrypt(doc.filePathEnc);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'File not found on disk');

  await writeAuditLog(req.user.sub, 'VIEW_KYC_DOCUMENT', 'kyc_documents', doc.id, req);

  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
  fs.createReadStream(filePath).pipe(res);
}));

export default router;
