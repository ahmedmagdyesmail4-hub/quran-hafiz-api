import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id"),
  guestName: text("guest_name"),
  gender: text("gender").notNull().default("male"),
  isOwner: text("is_owner").notNull().default("false"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
  timerRunning: text("timer_running").notNull().default("false"),
  timerTask: text("timer_task").default(""),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  timerElapsed: integer("timer_elapsed").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
