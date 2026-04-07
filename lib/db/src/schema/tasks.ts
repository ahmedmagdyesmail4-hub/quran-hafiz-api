import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  title: text("title").notNull(),
  description: text("description").default(""),
  durationMinutes: integer("duration_minutes").notNull().default(15),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberTasksTable = pgTable("member_tasks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  memberId: integer("member_id").notNull(),
  roomId: integer("room_id").notNull(),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const inviteCodesTable = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  type: text("type").notNull().default("private"),
  usedBy: integer("used_by"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const insertMemberTaskSchema = createInsertSchema(memberTasksTable).omit({ id: true, updatedAt: true });
export type InsertMemberTask = z.infer<typeof insertMemberTaskSchema>;
export type MemberTask = typeof memberTasksTable.$inferSelect;
