import express from "express"
import { CommentController } from "../controllers/comment-controller"

const router = express.Router()
const commentController = new CommentController()

// Comment routes
router.get("/task/:taskId", commentController.getCommentsByTask)
router.post("/task/:taskId", commentController.createComment)
router.get("/:id", commentController.getCommentById)
router.put("/:id", commentController.updateComment)
router.delete("/:id", commentController.deleteComment)

export default router
