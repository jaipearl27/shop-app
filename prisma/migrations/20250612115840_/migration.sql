/*
  Warnings:

  - A unique constraint covering the columns `[shop]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_shop_key" ON "User"("shop");
