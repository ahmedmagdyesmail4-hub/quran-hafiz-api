import { Router } from "express";
import authRouter from "./auth";
import roomsRouter from "./rooms";
import adminRouter from "./admin";

const router = Router();

router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/", roomsRouter);

export default router;
