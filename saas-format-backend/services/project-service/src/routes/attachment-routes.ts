import express from "express"
import { AttachmentController } from "../controllers/attachment-controller"

const router = express.Router()
const attachmentController = new AttachmentController()

// Attachment routes
router.get("/task/:taskId", attachmentController.getAttachmentsByTask)
router.post("/task/:taskId", attachmentController.createAttachment)
router.get("/:id", attachmentController.getAttachmentById)
router.delete("/:id", attachmentController.deleteAttachment)

export default router
