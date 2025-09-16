// Add this import at the top of the file
import * as loyaltyService from "./loyalty.service";
import type { IUser } from "../models/user.model";
import { createRequestLogger } from "../utils/logger";
import { User } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { sendWelcomeEmail } from "./email.service";

// Modify the createUser function to initialize loyalty program
export const createUser = async (userData: Partial<IUser>, requestId?: string): Promise<IUser> => {
  const logger = createRequestLogger(requestId);
  logger.info("Creating new user");

  try {
    // Check if user with same email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new ApiError("User with this email already exists", 400);
    }

    // Create new user
    const user = await User.create({
      ...userData,
      role: userData.role || "customer", // Default role is customer
      active: true,
      emailVerified: false,
    });

    // Initialize loyalty program for customers
    if (user.role === "customer") {
      try {
        await loyaltyService.getCustomerLoyaltyProgram(user._id.toString(), requestId);
      } catch (error) {
        logger.error(`Error initializing loyalty program: ${error.message}`);
        // Continue processing even if loyalty program initialization fails
      }
    }

    // Send welcome email
    if (user.email) {
      try {
        await sendWelcomeEmail(
          user.email,
          {
            firstName: user.firstName,
            storeName: process.env.STORE_NAME || "Our Store",
            year: new Date().getFullYear(),
            storeUrl: process.env.FRONTEND_URL || "https://example.com",
          },
          user.language || "en",
          requestId
        );
      } catch (emailError) {
        logger.error(`Error sending welcome email: ${emailError.message}`);
        // Continue processing even if email fails
      }
    }

    // Check for referral code in userData
    if (userData.referralCode) {
      try {
        await loyaltyService.applyReferralCode(
          user._id.toString(),
          userData.referralCode,
          requestId
        );
      } catch (referralError) {
        logger.error(`Error applying referral code: ${referralError.message}`);
        // Continue processing even if referral code application fails
      }
    }

    return user;
  } catch (error) {
    logger.error(`Error creating user: ${error.message}`);
    throw error;
  }
};
