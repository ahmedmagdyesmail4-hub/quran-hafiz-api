import { Router } from "express";
import { db } from "@workspace/db";
import { roomsTable, inviteCodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "";

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function checkAdmin(req: import("express").Request, res: import("express").Response): boolean {
  const { adminEmail, adminPass } = req.body as { adminEmail?: string; adminPass?: string };
  if (!ADMIN_EMAIL || !ADMIN_PASS) return true;
  if (adminEmail !== ADMIN_EMAIL || adminPass !== ADMIN_PASS) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

router.post("/gen-private-code", async (req, res) => {
  try {
    if (!checkAdmin(req, res)) return;
    let code: string;
    let attempts = 0;
    do {
      code = generateCode(8);
      const existing = await db
        .select({ id: inviteCodesTable.id })
        .from(inviteCodesTable)
        .where(eq(inviteCodesTable.code, code))
        .limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const [invite] = await db
      .insert(inviteCodesTable)
      .values({ code: code!, type: "private" })
      .returning();
    res.json({ code: invite.code });
  } catch (err) {
    req.log.error({ err }, "Gen private code error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/gen-teacher-code", async (req, res) => {
  try {
    if (!checkAdmin(req, res)) return;
    let code: string;
    let attempts = 0;
    do {
      code = generateCode(8);
      const existing = await db
        .select({ id: inviteCodesTable.id })
        .from(inviteCodesTable)
        .where(eq(inviteCodesTable.code, code))
        .limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const [invite] = await db
      .insert(inviteCodesTable)
      .values({ code: code!, type: "teacher" })
      .returning();
    res.json({ code: invite.code });
  } catch (err) {
    req.log.error({ err }, "Gen teacher code error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/create-public", async (req, res) => {
  try {
    if (!checkAdmin(req, res)) return;
    const { name, type } = req.body as { name: string; type: string };
    if (!name || !type) {
      res.status(400).json({ error: "الاسم والنوع مطلوبان" });
      return;
    }
    const validPublicTypes = ["public_male", "public_female"];
    if (!validPublicTypes.includes(type)) {
      res.status(400).json({ error: "نوع الغرفة غير صالح" });
      return;
    }
    let code: string;
    let attempts = 0;
    do {
      code = generateCode(6);
      const existing = await db
        .select({ id: roomsTable.id })
        .from(roomsTable)
        .where(eq(roomsTable.code, code))
        .limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const [room] = await db
      .insert(roomsTable)
      .values({
        name,
        type: type as "public_male" | "public_female",
        code: code!,
      })
      .returning();
    res.json(room);
  } catch (err) {
    req.log.error({ err }, "Create public room error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
