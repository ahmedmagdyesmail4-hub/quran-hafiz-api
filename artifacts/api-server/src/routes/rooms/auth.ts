import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const router = Router();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      type: user.type,
      gender: user.gender,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, type, gender, inviteCode } = req.body as {
      name: string;
      email: string;
      password: string;
      type?: string;
      gender?: string;
      inviteCode?: string;
    };
    if (!name || !email || !password) {
      res.status(400).json({ error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبة" });
      return;
    }
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const userType = (type === "teacher" || type === "teacherF") ? type : "student";
    const userGender = gender === "female" ? "female" : "male";

    const [user] = await db.insert(usersTable).values({
      name,
      email,
      passwordHash,
      type: userType as "student" | "teacher" | "teacherF",
      gender: userGender as "male" | "female",
    }).returning();

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      type: user.type,
      gender: user.gender,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
