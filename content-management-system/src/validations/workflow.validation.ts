import Joi from "joi"
import { WorkflowStatus, WorkflowStepType, WorkflowTriggerType } from "../services/workflow.service"

export const workflowValidation = {
  // Create workflow validation
  createWorkflow: Joi.object({
    body: Joi.object({
      name: Joi.string().required().messages({
        "any.required": "Name is required",
      }),
      description: Joi.string(),
      contentTypeId: Joi.string(),
      steps: Joi.array()
        .items(
          Joi.object({
            id: Joi.string().required(),
            name: Joi.string().required(),
            type: Joi.string()
              .valid(...Object.values(WorkflowStepType))
              .required(),
            description: Joi.string(),
            config: Joi.object().default({}),
            nextSteps: Joi.array().items(Joi.string()).default([]),
            position: Joi.object({
              x: Joi.number().default(0),
              y: Joi.number().default(0),
            }).default({ x: 0, y: 0 }),
          }),
        )
        .required()
        .messages({
          "any.required": "Steps are required",
        }),
      triggers: Joi.array()
        .items(
          Joi.object({
            type: Joi.string()
              .valid(...Object.values(WorkflowTriggerType))
              .required(),
            config: Joi.object().default({}),
          }),
        )
        .required()
        .messages({
          "any.required": "Triggers are required",
        }),
      startStepId: Joi.string().required().messages({
        "any.required": "Start step ID is required",
      }),
      isDefault: Joi.boolean().default(false),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update workflow validation
  updateWorkflow: Joi.object({
    body: Joi.object({
      name: Joi.string(),
      description: Joi.string(),
      status: Joi.string().valid(...Object.values(WorkflowStatus)),
      contentTypeId: Joi.string(),
      steps: Joi.array().items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required(),
          type: Joi.string()
            .valid(...Object.values(WorkflowStepType))
            .required(),
          description: Joi.string(),
          config: Joi.object().default({}),
          nextSteps: Joi.array().items(Joi.string()).default([]),
          position: Joi.object({
            x: Joi.number().default(0),
            y: Joi.number().default(0),
          }).default({ x: 0, y: 0 }),
        }),
      ),
      triggers: Joi.array().items(
        Joi.object({
          type: Joi.string()
            .valid(...Object.values(WorkflowTriggerType))
            .required(),
          config: Joi.object().default({}),
        }),
      ),
      startStepId: Joi.string(),
      isDefault: Joi.boolean(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Workflow ID is required",
      }),
    }),
  }),

  // Trigger workflow validation
  triggerWorkflow: Joi.object({
    body: Joi.object({
      triggerType: Joi.string()
        .valid(...Object.values(WorkflowTriggerType))
        .required()
        .messages({
          "any.required": "Trigger type is required",
        }),
      contentId: Joi.string(),
      contentTypeId: Joi.string(),
      userId: Joi.string(),
      mediaId: Joi.string(),
      data: Joi.object().default({}),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Create workflow instance validation
  createWorkflowInstance: Joi.object({
    body: Joi.object({
      workflowId: Joi.string().required().messages({
        "any.required": "Workflow ID is required",
      }),
      contentId: Joi.string(),
      contentTypeId: Joi.string(),
      userId: Joi.string(),
      mediaId: Joi.string(),
      data: Joi.object().default({}),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Complete workflow step validation
  completeWorkflowStep: Joi.object({
    body: Joi.object({
      result: Joi.any(),
      notes: Joi.string(),
      nextStepId: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      instanceId: Joi.string().required().messages({
        "any.required": "Instance ID is required",
      }),
      stepId: Joi.string().required().messages({
        "any.required": "Step ID is required",
      }),
    }),
  }),

  // Reject workflow step validation
  rejectWorkflowStep: Joi.object({
    body: Joi.object({
      reason: Joi.string().required().messages({
        "any.required": "Reason is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      instanceId: Joi.string().required().messages({
        "any.required": "Instance ID is required",
      }),
      stepId: Joi.string().required().messages({
        "any.required": "Step ID is required",
      }),
    }),
  }),

  // Assign workflow step validation
  assignWorkflowStep: Joi.object({
    body: Joi.object({
      assigneeId: Joi.string().required().messages({
        "any.required": "Assignee ID is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      instanceId: Joi.string().required().messages({
        "any.required": "Instance ID is required",
      }),
      stepId: Joi.string().required().messages({
        "any.required": "Step ID is required",
      }),
    }),
  }),
}
