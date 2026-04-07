import { Router } from "express";
import { db } from "@workspace/db";
import { roomsTable, membersTable, tasksTable, memberTasksTable, inviteCodesTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

router.get("/public", async (req, res) => {
  try {
    const rooms = await db
      .select()
      .from(roomsTable)
      .where(and(
        eq(roomsTable.isActive, "true"),
        inArray(roomsTable.type, ["public_male", "public_female"])
      ));
    res.json(rooms);
  } catch (err) {
    req.log.error({ err }, "Get public rooms error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/my/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      res.status(400).json({ error: "معرف المستخدم غير صالح" });
      return;
    }
    const memberRows = await db
      .select({ roomId: membersTable.roomId })
      .from(membersTable)
      .where(eq(membersTable.userId, userId));
    const roomIds = memberRows.map((m) => m.roomId);
    if (roomIds.length === 0) {
      res.json([]);
      return;
    }
    const rooms = await db
      .select()
      .from(roomsTable)
      .where(and(eq(roomsTable.isActive, "true"), inArray(roomsTable.id, roomIds)));
    res.json(rooms);
  } catch (err) {
    req.log.error({ err }, "Get my rooms error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/join", async (req, res) => {
  try {
    const { code, name, gender, userId } = req.body as {
      code: string;
      name?: string;
      gender?: string;
      userId?: number;
    };
    if (!code) {
      res.status(400).json({ error: "كود الغرفة مطلوب" });
      return;
    }
    const upperCode = code.trim().toUpperCase();
    const [room] = await db
      .select()
      .from(roomsTable)
      .where(and(eq(roomsTable.code, upperCode), eq(roomsTable.isActive, "true")))
      .limit(1);
    if (!room) {
      const [invite] = await db
        .select()
        .from(inviteCodesTable)
        .where(eq(inviteCodesTable.code, upperCode))
        .limit(1);
      if (!invite) {
        res.status(404).json({ error: "الكود غير صحيح أو الغرفة غير موجودة" });
        return;
      }
    }
    const targetRoom = room;
    if (!targetRoom) {
      res.status(404).json({ error: "الغرفة غير موجودة" });
      return;
    }
    const [member] = await db
      .insert(membersTable)
      .values({
        roomId: targetRoom.id,
        userId: userId ?? null,
        guestName: name ?? null,
        gender: gender ?? "male",
        isOwner: "false",
      })
      .returning();
    res.json({
      room: targetRoom,
      memberId: member.id,
      displayName: name ?? "ضيف",
      isOwner: false,
    });
  } catch (err) {
    req.log.error({ err }, "Join room error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/create", async (req, res) => {
  try {
    const { name, type, ownerId, ownerName, gender } = req.body as {
      name: string;
      type: string;
      ownerId?: number;
      ownerName?: string;
      gender?: string;
    };
    if (!name || !type) {
      res.status(400).json({ error: "اسم الغرفة والنوع مطلوبان" });
      return;
    }
    const validTypes = ["public_male", "public_female", "private", "teacher"];
    if (!validTypes.includes(type)) {
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
        type: type as "public_male" | "public_female" | "private" | "teacher",
        code,
        ownerId: ownerId ?? null,
      })
      .returning();

    const [member] = await db
      .insert(membersTable)
      .values({
        roomId: room.id,
        userId: ownerId ?? null,
        guestName: ownerName ?? null,
        gender: gender ?? "male",
        isOwner: "true",
      })
      .returning();

    res.json({ room, memberId: member.id, isOwner: true });
  } catch (err) {
    req.log.error({ err }, "Create room error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/:code/state", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.code, code))
      .limit(1);
    if (!room) {
      res.status(404).json({ error: "الغرفة غير موجودة" });
      return;
    }
    const members = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.roomId, room.id));
    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.roomId, room.id));
    const memberTasks = tasks.length > 0
      ? await db
          .select()
          .from(memberTasksTable)
          .where(eq(memberTasksTable.roomId, room.id))
      : [];
    res.json({ room, members, tasks, memberTasks });
  } catch (err) {
    req.log.error({ err }, "Get room state error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.patch("/members/:memberId/status", async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      res.status(400).json({ error: "معرف العضو غير صالح" });
      return;
    }
    const { timerRunning, timerTask, timerStartedAt, timerElapsed } = req.body as {
      timerRunning?: string;
      timerTask?: string;
      timerStartedAt?: string;
      timerElapsed?: number;
    };
    const updates: Record<string, unknown> = {
      lastSeen: new Date(),
    };
    if (timerRunning !== undefined) updates.timerRunning = timerRunning;
    if (timerTask !== undefined) updates.timerTask = timerTask;
    if (timerStartedAt !== undefined) updates.timerStartedAt = new Date(timerStartedAt);
    if (timerElapsed !== undefined) updates.timerElapsed = timerElapsed;

    await db
      .update(membersTable)
      .set(updates)
      .where(eq(membersTable.id, memberId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Update member status error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/tasks/:taskId/complete", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "معرف المهمة غير صالح" });
      return;
    }
    const { memberId, roomId } = req.body as { memberId: number; roomId: number };
    const existing = await db
      .select()
      .from(memberTasksTable)
      .where(and(eq(memberTasksTable.taskId, taskId), eq(memberTasksTable.memberId, memberId)))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(memberTasksTable)
        .set({ status: "done", completedAt: new Date() })
        .where(and(eq(memberTasksTable.taskId, taskId), eq(memberTasksTable.memberId, memberId)));
    } else {
      await db.insert(memberTasksTable).values({
        taskId,
        memberId,
        roomId,
        status: "done",
        completedAt: new Date(),
      });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Complete task error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    await db
      .update(roomsTable)
      .set({ isActive: "false" })
      .where(eq(roomsTable.code, code));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete room error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/:code/announcement", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { announcement } = req.body as { announcement: string };
    await db
      .update(roomsTable)
      .set({ announcement: announcement ?? "" })
      .where(eq(roomsTable.code, code));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Save announcement error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/:code/tasks", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { title, description, durationMinutes, createdBy } = req.body as {
      title: string;
      description?: string;
      durationMinutes?: number;
      createdBy?: number;
    };
    if (!title) {
      res.status(400).json({ error: "عنوان المهمة مطلوب" });
      return;
    }
    const [room] = await db
      .select({ id: roomsTable.id })
      .from(roomsTable)
      .where(eq(roomsTable.code, code))
      .limit(1);
    if (!room) {
      res.status(404).json({ error: "الغرفة غير موجودة" });
      return;
    }
    const [task] = await db
      .insert(tasksTable)
      .values({
        roomId: room.id,
        title,
        description: description ?? "",
        durationMinutes: durationMinutes ?? 15,
        createdBy: createdBy ?? null,
      })
      .returning();
    res.json(task);
  } catch (err) {
    req.log.error({ err }, "Add task error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
