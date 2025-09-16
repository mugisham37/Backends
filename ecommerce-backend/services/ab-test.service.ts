import { ABTest, UserTestAssignment } from "../models/ab-test.model";
import { createRequestLogger } from "../config/logger";
import { getCache, setCache } from "../config/redis";
import { ApiError } from "../utils/api-error";

// Cache TTL in seconds
const CACHE_TTL = {
  ACTIVE_TESTS: 300, // 5 minutes
  TEST_DETAILS: 300, // 5 minutes
  USER_ASSIGNMENTS: 300, // 5 minutes
};

/**
 * Create a new A/B test
 * @param testData Test data
 * @param requestId Request ID for logging
 * @returns Created test
 */
export const createABTest = async (testData: any, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info("Creating A/B test");

  try {
    // Create test
    const test = await ABTest.create(testData);

    // Clear cache
    await setCache("active_tests", null, 0);

    return test.toObject();
  } catch (error) {
    logger.error(`Error creating A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Update an A/B test
 * @param testId Test ID
 * @param testData Test data
 * @param requestId Request ID for logging
 * @returns Updated test
 */
export const updateABTest = async (
  testId: string,
  testData: any,
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Updating A/B test: ${testId}`);

  try {
    // Find test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test is completed
    if (test.status === "completed") {
      throw new ApiError("Cannot update a completed test", 400);
    }

    // Update test
    Object.keys(testData).forEach((key) => {
      if (
        key !== "_id" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "results" &&
        key !== "winner"
      ) {
        test[key] = testData[key];
      }
    });

    // Save test
    await test.save();

    // Clear cache
    await setCache("active_tests", null, 0);
    await setCache(`test:${testId}`, null, 0);

    return test.toObject();
  } catch (error) {
    logger.error(`Error updating A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Get all A/B tests
 * @param filters Filters
 * @param requestId Request ID for logging
 * @returns A/B tests
 */
export const getABTests = async (
  filters: {
    status?: string;
    type?: string;
  } = {},
  requestId?: string
): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting A/B tests");

  try {
    // Build query
    const query: Record<string, any> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    // Get tests
    const tests = await ABTest.find(query).sort("-createdAt").lean();

    return tests;
  } catch (error) {
    logger.error(`Error getting A/B tests: ${error.message}`);
    throw error;
  }
};

/**
 * Get active A/B tests
 * @param requestId Request ID for logging
 * @returns Active A/B tests
 */
export const getActiveABTests = async (requestId?: string): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info("Getting active A/B tests");

  // Try to get from cache
  const cacheKey = "active_tests";
  const cachedTests = await getCache<any[]>(cacheKey);

  if (cachedTests) {
    logger.info("Retrieved active A/B tests from cache");
    return cachedTests;
  }

  try {
    // Get active tests
    const tests = await ABTest.find({
      status: "running",
      $or: [{ endDate: { $gt: new Date() } }, { endDate: null }],
    }).lean();

    // Cache tests
    await setCache(cacheKey, tests, CACHE_TTL.ACTIVE_TESTS);

    return tests;
  } catch (error) {
    logger.error(`Error getting active A/B tests: ${error.message}`);
    throw error;
  }
};

/**
 * Get A/B test by ID
 * @param testId Test ID
 * @param requestId Request ID for logging
 * @returns A/B test
 */
export const getABTestById = async (testId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting A/B test: ${testId}`);

  // Try to get from cache
  const cacheKey = `test:${testId}`;
  const cachedTest = await getCache<any>(cacheKey);

  if (cachedTest) {
    logger.info("Retrieved A/B test from cache");
    return cachedTest;
  }

  try {
    // Get test
    const test = await ABTest.findById(testId).lean();
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Cache test
    await setCache(cacheKey, test, CACHE_TTL.TEST_DETAILS);

    return test;
  } catch (error) {
    logger.error(`Error getting A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Start an A/B test
 * @param testId Test ID
 * @param requestId Request ID for logging
 * @returns Updated test
 */
export const startABTest = async (testId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Starting A/B test: ${testId}`);

  try {
    // Find test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test can be started
    if (test.status === "running") {
      throw new ApiError("Test is already running", 400);
    }

    if (test.status === "completed") {
      throw new ApiError("Cannot start a completed test", 400);
    }

    // Update test
    test.status = "running";
    test.startDate = new Date();

    // Save test
    await test.save();

    // Clear cache
    await setCache("active_tests", null, 0);
    await setCache(`test:${testId}`, null, 0);

    return test.toObject();
  } catch (error) {
    logger.error(`Error starting A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Pause an A/B test
 * @param testId Test ID
 * @param requestId Request ID for logging
 * @returns Updated test
 */
export const pauseABTest = async (testId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Pausing A/B test: ${testId}`);

  try {
    // Find test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test can be paused
    if (test.status !== "running") {
      throw new ApiError("Test is not running", 400);
    }

    // Update test
    test.status = "paused";

    // Save test
    await test.save();

    // Clear cache
    await setCache("active_tests", null, 0);
    await setCache(`test:${testId}`, null, 0);

    return test.toObject();
  } catch (error) {
    logger.error(`Error pausing A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Complete an A/B test
 * @param testId Test ID
 * @param winner Winner variant name
 * @param requestId Request ID for logging
 * @returns Updated test
 */
export const completeABTest = async (
  testId: string,
  winner?: string,
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Completing A/B test: ${testId}`);

  try {
    // Find test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test can be completed
    if (test.status === "completed") {
      throw new ApiError("Test is already completed", 400);
    }

    // Update test
    test.status = "completed";
    test.endDate = new Date();

    // Set winner if provided
    if (winner) {
      // Check if winner is a valid variant
      const isValidVariant = test.variants.some((variant) => variant.name === winner);
      if (!isValidVariant) {
        throw new ApiError("Invalid winner variant", 400);
      }

      test.winner = winner;
    } else {
      // Determine winner based on primary goal
      const winner = determineWinner(test);
      if (winner) {
        test.winner = winner;
      }
    }

    // Save test
    await test.save();

    // Clear cache
    await setCache("active_tests", null, 0);
    await setCache(`test:${testId}`, null, 0);

    return test.toObject();
  } catch (error) {
    logger.error(`Error completing A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Delete an A/B test
 * @param testId Test ID
 * @param requestId Request ID for logging
 * @returns Deleted test
 */
export const deleteABTest = async (testId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Deleting A/B test: ${testId}`);

  try {
    // Find test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test can be deleted
    if (test.status === "running") {
      throw new ApiError("Cannot delete a running test", 400);
    }

    // Delete test
    await test.deleteOne();

    // Delete user assignments
    await UserTestAssignment.deleteMany({ test: testId });

    // Clear cache
    await setCache("active_tests", null, 0);
    await setCache(`test:${testId}`, null, 0);

    return test.toObject();
  } catch (error) {
    logger.error(`Error deleting A/B test: ${error.message}`);
    throw error;
  }
};

/**
 * Get user's test assignment
 * @param userId User ID
 * @param testId Test ID
 * @param requestId Request ID for logging
 * @returns User's test assignment
 */
export const getUserTestAssignment = async (
  userId: string,
  testId: string,
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting test assignment for user: ${userId}, test: ${testId}`);

  // Try to get from cache
  const cacheKey = `user_assignment:${userId}:${testId}`;
  const cachedAssignment = await getCache<any>(cacheKey);

  if (cachedAssignment) {
    logger.info("Retrieved user test assignment from cache");
    return cachedAssignment;
  }

  try {
    // Get test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test is running
    if (test.status !== "running") {
      throw new ApiError("Test is not running", 400);
    }

    // Get user's assignment
    let assignment = await UserTestAssignment.findOne({ user: userId, test: testId }).lean();

    // If assignment doesn't exist, create it
    if (!assignment) {
      // Assign variant based on traffic allocation
      const variant = assignVariant(test.variants);

      // Create assignment
      const newAssignment = await UserTestAssignment.create({
        user: userId,
        test: testId,
        variant,
      });

      assignment = newAssignment.toObject();
    }

    // Get variant details
    const variantDetails = test.variants.find((v) => v.name === assignment.variant);

    // Add variant details to response
    const result = {
      ...assignment,
      variantDetails,
    };

    // Cache result
    await setCache(cacheKey, result, CACHE_TTL.USER_ASSIGNMENTS);

    return result;
  } catch (error) {
    logger.error(`Error getting user test assignment: ${error.message}`);
    throw error;
  }
};

/**
 * Get all user's test assignments
 * @param userId User ID
 * @param requestId Request ID for logging
 * @returns User's test assignments
 */
export const getUserTestAssignments = async (
  userId: string,
  requestId?: string
): Promise<any[]> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting all test assignments for user: ${userId}`);

  try {
    // Get active tests
    const activeTests = await getActiveABTests(requestId);

    // Get user's assignments for active tests
    const assignments = await Promise.all(
      activeTests.map(async (test) => {
        try {
          const assignment = await getUserTestAssignment(userId, test._id.toString(), requestId);
          return {
            test: {
              _id: test._id,
              name: test.name,
              type: test.type,
            },
            variant: assignment.variant,
            variantDetails: assignment.variantDetails,
          };
        } catch (error) {
          logger.error(`Error getting assignment for test ${test._id}: ${error.message}`);
          return null;
        }
      })
    );

    // Filter out null assignments
    return assignments.filter(Boolean);
  } catch (error) {
    logger.error(`Error getting user test assignments: ${error.message}`);
    throw error;
  }
};

/**
 * Track test event
 * @param userId User ID
 * @param testId Test ID
 * @param eventType Event type
 * @param eventData Event data
 * @param requestId Request ID for logging
 * @returns Updated assignment
 */
export const trackTestEvent = async (
  userId: string,
  testId: string,
  eventType: "impression" | "conversion" | "revenue" | "engagement",
  eventData: {
    amount?: number;
  } = {},
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Tracking test event for user: ${userId}, test: ${testId}, event: ${eventType}`);

  try {
    // Get test
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Check if test is running
    if (test.status !== "running") {
      logger.info("Test is not running, not tracking event");
      return null;
    }

    // Get user's assignment
    let assignment = await UserTestAssignment.findOne({ user: userId, test: testId });
    if (!assignment) {
      // Create assignment if it doesn't exist
      const variant = assignVariant(test.variants);
      assignment = await UserTestAssignment.create({
        user: userId,
        test: testId,
        variant,
      });
    }

    // Update assignment based on event type
    switch (eventType) {
      case "impression":
        assignment.impressions += 1;
        break;
      case "conversion":
        assignment.conversions += 1;
        break;
      case "revenue":
        assignment.revenue += eventData.amount || 0;
        break;
      case "engagement":
        assignment.engagements += 1;
        break;
    }

    // Update last activity
    assignment.lastActivity = new Date();

    // Save assignment
    await assignment.save();

    // Update test results
    await updateTestResults(test, assignment.variant, eventType, eventData);

    // Clear cache
    const cacheKey = `user_assignment:${userId}:${testId}`;
    await setCache(cacheKey, null, 0);
    await setCache(`test:${testId}`, null, 0);

    return assignment.toObject();
  } catch (error) {
    logger.error(`Error tracking test event: ${error.message}`);
    throw error;
  }
};

/**
 * Get test results
 * @param testId Test ID
 * @param requestId Request ID for logging
 * @returns Test results
 */
export const getTestResults = async (testId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting test results for test: ${testId}`);

  try {
    // Get test
    const test = await ABTest.findById(testId).lean();
    if (!test) {
      throw new ApiError("A/B test not found", 404);
    }

    // Get assignments for this test
    const assignments = await UserTestAssignment.find({ test: testId }).lean();

    // Calculate results by variant
    const resultsByVariant = test.variants.map((variant) => {
      // Get assignments for this variant
      const variantAssignments = assignments.filter((a) => a.variant === variant.name);

      // Calculate metrics
      const impressions = variantAssignments.reduce((sum, a) => sum + a.impressions, 0);
      const conversions = variantAssignments.reduce((sum, a) => sum + a.conversions, 0);
      const revenue = variantAssignments.reduce((sum, a) => sum + a.revenue, 0);
      const engagements = variantAssignments.reduce((sum, a) => sum + a.engagements, 0);

      // Calculate conversion rate
      const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;

      // Calculate average revenue per user
      const averageRevenue =
        variantAssignments.length > 0 ? revenue / variantAssignments.length : 0;

      return {
        variant: variant.name,
        users: variantAssignments.length,
        impressions,
        conversions,
        revenue,
        engagements,
        conversionRate: Number.parseFloat(conversionRate.toFixed(2)),
        averageRevenue: Number.parseFloat(averageRevenue.toFixed(2)),
      };
    });

    // Calculate statistical significance
    const significanceResults = calculateStatisticalSignificance(resultsByVariant);

    return {
      test,
      resultsByVariant,
      significance: significanceResults,
      winner: test.winner || significanceResults.winner,
    };
  } catch (error) {
    logger.error(`Error getting test results: ${error.message}`);
    throw error;
  }
};

/**
 * Assign variant based on traffic allocation
 * @param variants Test variants
 * @returns Assigned variant name
 */
const assignVariant = (variants: any[]): string => {
  // Generate random number between 0 and 100
  const random = Math.random() * 100;

  // Calculate cumulative allocation
  let cumulativeAllocation = 0;

  // Find variant based on traffic allocation
  for (const variant of variants) {
    cumulativeAllocation += variant.trafficAllocation;
    if (random <= cumulativeAllocation) {
      return variant.name;
    }
  }

  // Default to first variant
  return variants[0].name;
};

/**
 * Update test results
 * @param test A/B test
 * @param variant Variant name
 * @param eventType Event type
 * @param eventData Event data
 */
const updateTestResults = async (
  test: any,
  variant: string,
  eventType: "impression" | "conversion" | "revenue" | "engagement",
  eventData: {
    amount?: number;
  } = {}
): Promise<void> => {
  // Get current results
  const results = test.results || {
    impressions: new Map(),
    conversions: new Map(),
    revenue: new Map(),
    engagements: new Map(),
  };

  // Update results based on event type
  switch (eventType) {
    case "impression":
      results.impressions.set(variant, (results.impressions.get(variant) || 0) + 1);
      break;
    case "conversion":
      results.conversions.set(variant, (results.conversions.get(variant) || 0) + 1);
      break;
    case "revenue":
      results.revenue.set(variant, (results.revenue.get(variant) || 0) + (eventData.amount || 0));
      break;
    case "engagement":
      results.engagements.set(variant, (results.engagements.get(variant) || 0) + 1);
      break;
  }

  // Update test
  test.results = results;
  await test.save();
};

/**
 * Determine winner based on primary goal
 * @param test A/B test
 * @returns Winner variant name or null
 */
const determineWinner = (test: any): string | null => {
  // Get primary goal
  const primaryGoal = test.goals.primary;

  // Get results
  const results = test.results || {
    impressions: new Map(),
    conversions: new Map(),
    revenue: new Map(),
    engagements: new Map(),
  };

  // Determine winner based on primary goal
  switch (primaryGoal) {
    case "conversion":
      return determineWinnerByMetric(test.variants, results.conversions, results.impressions);
    case "revenue":
      return determineWinnerByMetric(test.variants, results.revenue);
    case "engagement":
      return determineWinnerByMetric(test.variants, results.engagements);
    default:
      return null;
  }
};

/**
 * Determine winner by metric
 * @param variants Test variants
 * @param metricMap Metric map
 * @param denominatorMap Denominator map (for rates)
 * @returns Winner variant name or null
 */
const determineWinnerByMetric = (
  variants: any[],
  metricMap: Map<string, number>,
  denominatorMap?: Map<string, number>
): string | null => {
  // If no data, return null
  if (metricMap.size === 0) {
    return null;
  }

  // Calculate metric value for each variant
  const variantMetrics = variants.map((variant) => {
    const metricValue = metricMap.get(variant.name) || 0;
    const denominatorValue = denominatorMap ? denominatorMap.get(variant.name) || 0 : 1;

    // Calculate rate if denominator is provided
    const value = denominatorMap
      ? denominatorValue > 0
        ? metricValue / denominatorValue
        : 0
      : metricValue;

    return {
      name: variant.name,
      value,
    };
  });

  // Sort by metric value (descending)
  variantMetrics.sort((a, b) => b.value - a.value);

  // Return variant with highest metric value
  return variantMetrics[0].value > 0 ? variantMetrics[0].name : null;
};

/**
 * Calculate statistical significance
 * @param results Results by variant
 * @returns Significance results
 */
const calculateStatisticalSignificance = (results: any[]): any => {
  // If less than 2 variants, return null
  if (results.length < 2) {
    return {
      isSignificant: false,
      confidenceLevel: 0,
      winner: null,
    };
  }

  // Sort variants by conversion rate (descending)
  const sortedResults = [...results].sort((a, b) => b.conversionRate - a.conversionRate);

  // Get control and variation
  const control = sortedResults[1];
  const variation = sortedResults[0];

  // Calculate z-score
  const p1 = control.conversions / control.impressions;
  const p2 = variation.conversions / variation.impressions;
  const p =
    (control.conversions + variation.conversions) / (control.impressions + variation.impressions);
  const se = Math.sqrt(p * (1 - p) * (1 / control.impressions + 1 / variation.impressions));

  // Avoid division by zero
  const zScore = se > 0 ? (p2 - p1) / se : 0;

  // Calculate confidence level
  const confidenceLevel = calculateConfidenceLevel(zScore);

  // Determine if result is significant (95% confidence)
  const isSignificant = confidenceLevel >= 95;

  return {
    isSignificant,
    confidenceLevel,
    winner: isSignificant ? variation.variant : null,
    control: control.variant,
    variation: variation.variant,
    improvement: p1 > 0 ? ((p2 - p1) / p1) * 100 : 0,
  };
};

/**
 * Calculate confidence level from z-score
 * @param zScore Z-score
 * @returns Confidence level (0-100)
 */
const calculateConfidenceLevel = (zScore: number): number => {
  // Approximate confidence level from z-score
  // This is a simplified calculation
  const absZ = Math.abs(zScore);
  let confidence = 0;

  if (absZ >= 1.96) {
    confidence = 95;
  } else if (absZ >= 1.645) {
    confidence = 90;
  } else if (absZ >= 1.28) {
    confidence = 80;
  } else if (absZ >= 0.84) {
    confidence = 60;
  } else {
    confidence = 50;
  }

  return confidence;
};
