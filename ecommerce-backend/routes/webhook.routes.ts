import express from "express";
const router = express.Router();
import * as webhookController from "../controllers/webhook.controller";

// Add this to the existing webhook routes
router.post("/loyalty", webhookController.handleLoyaltyWebhook);
