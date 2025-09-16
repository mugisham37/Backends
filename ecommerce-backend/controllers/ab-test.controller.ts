import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { createRequestLogger } from "../config/logger";
import * as abTestService from "../services/ab-test.service";

/**
 * Create a new A/B test
 * @route POST /api/v1/ab-tests
 * @access Protected (Admin)
 */
export const createABTest = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Creating A/B test");

  const test = await abTestService.createABTest(req.body, req.id);

  res.status(201).json({
    status: "success",
    requestId: req.id,
    data: test,
  });
});

/**
 * Get all A/B tests
 * @route GET /api/v1/ab-tests
 * @access Protected (Admin)
 */
export const getABTests = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Getting A/B tests");

  const filters = {
    status: req.query.status as string | undefined,
    type: req.query.type as string | undefined,
  };

  const tests = await abTestService.getABTests(filters, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: tests.length,
    data: tests,
  });
});

/**
 * Get A/B test by ID
 * @route GET /api/v1/ab-tests/:id
 * @access Protected (Admin)
 */
export const getABTestById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    requestLogger.info(`Getting A/B test: ${id}`);

    const test = await abTestService.getABTestById(id, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: test,
    });
  }
);

/**
 * Update A/B test
 * @route PUT /api/v1/ab-tests/:id
 * @access Protected (Admin)
 */
export const updateABTest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    requestLogger.info(`Updating A/B test: ${id}`);

    const test = await abTestService.updateABTest(id, req.body, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: test,
    });
  }
);

/**
 * Start A/B test
 * @route POST /api/v1/ab-tests/:id/start
 * @access Protected (Admin)
 */
export const startABTest = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id);
  const { id } = req.params;

  if (!id) {
    return next(new ApiError("Test ID is required", 400));
  }

  requestLogger.info(`Starting A/B test: ${id}`);

  const test = await abTestService.startABTest(id, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: test,
  });
});

/**
 * Pause A/B test
 * @route POST /api/v1/ab-tests/:id/pause
 * @access Protected (Admin)
 */
export const pauseABTest = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(req.id);
  const { id } = req.params;

  if (!id) {
    return next(new ApiError("Test ID is required", 400));
  }

  requestLogger.info(`Pausing A/B test: ${id}`);

  const test = await abTestService.pauseABTest(id, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: test,
  });
});

/**
 * Complete A/B test
 * @route POST /api/v1/ab-tests/:id/complete
 * @access Protected (Admin)
 */
export const completeABTest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;
    const { winner } = req.body;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    requestLogger.info(`Completing A/B test: ${id}`);

    const test = await abTestService.completeABTest(id, winner, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: test,
    });
  }
);

/**
 * Delete A/B test
 * @route DELETE /api/v1/ab-tests/:id
 * @access Protected (Admin)
 */
export const deleteABTest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    requestLogger.info(`Deleting A/B test: ${id}`);

    const test = await abTestService.deleteABTest(id, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: test,
    });
  }
);

/**
 * Get test results
 * @route GET /api/v1/ab-tests/:id/results
 * @access Protected (Admin)
 */
export const getTestResults = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    requestLogger.info(`Getting test results for test: ${id}`);

    const results = await abTestService.getTestResults(id, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: results,
    });
  }
);

/**
 * Get user's test assignment
 * @route GET /api/v1/ab-tests/:id/assignment
 * @access Protected
 */
export const getUserTestAssignment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;
    const userId = req.user._id;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    requestLogger.info(`Getting test assignment for user: ${userId}, test: ${id}`);

    const assignment = await abTestService.getUserTestAssignment(userId.toString(), id, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: assignment,
    });
  }
);

/**
 * Get all user's test assignments
 * @route GET /api/v1/ab-tests/assignments
 * @access Protected
 */
export const getUserTestAssignments = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  const userId = req.user._id;

  requestLogger.info(`Getting all test assignments for user: ${userId}`);

  const assignments = await abTestService.getUserTestAssignments(userId.toString(), req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: assignments.length,
    data: assignments,
  });
});

/**
 * Track test event
 * @route POST /api/v1/ab-tests/:id/track
 * @access Protected
 */
export const trackTestEvent = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const { id } = req.params;
    const userId = req.user._id;
    const { eventType, amount } = req.body;

    if (!id) {
      return next(new ApiError("Test ID is required", 400));
    }

    if (!eventType) {
      return next(new ApiError("Event type is required", 400));
    }

    if (!["impression", "conversion", "revenue", "engagement"].includes(eventType)) {
      return next(new ApiError("Invalid event type", 400));
    }

    requestLogger.info(`Tracking test event for user: ${userId}, test: ${id}, event: ${eventType}`);

    const assignment = await abTestService.trackTestEvent(
      userId.toString(),
      id,
      eventType,
      { amount },
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: assignment,
    });
  }
);
