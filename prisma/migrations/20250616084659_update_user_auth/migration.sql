-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "token" TEXT,
    "authorized" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("id", "password", "shop", "token", "username") SELECT "id", "password", "shop", "token", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_shop_key" ON "User"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
