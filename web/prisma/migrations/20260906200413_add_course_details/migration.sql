-- AlterTable
ALTER TABLE "CourseOffering" ADD COLUMN "apiCoreq" JSONB;
ALTER TABLE "CourseOffering" ADD COLUMN "apiCoreqTree" JSONB;
ALTER TABLE "CourseOffering" ADD COLUMN "apiPrereqText" TEXT;
ALTER TABLE "CourseOffering" ADD COLUMN "apiPrereqTree" JSONB;
ALTER TABLE "CourseOffering" ADD COLUMN "detailsCompl" JSONB;
ALTER TABLE "CourseOffering" ADD COLUMN "detailsError" TEXT;
ALTER TABLE "CourseOffering" ADD COLUMN "detailsMaster" JSONB;
ALTER TABLE "CourseOffering" ADD COLUMN "detailsNrc" TEXT;
ALTER TABLE "CourseOffering" ADD COLUMN "detailsSyncedAt" DATETIME;
ALTER TABLE "CourseOffering" ADD COLUMN "restrictions" JSONB;
