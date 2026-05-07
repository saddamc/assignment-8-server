-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'DISABLED';

-- AlterTable
ALTER TABLE "product_approvals" ADD COLUMN     "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "autoApproveProducts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_approval_histories" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ProductApprovalStatus" NOT NULL,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_approval_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_approval_histories_productId_idx" ON "product_approval_histories"("productId");

-- AddForeignKey
ALTER TABLE "product_approval_histories" ADD CONSTRAINT "product_approval_histories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
