import mongoose, { type Document, Schema } from "mongoose"
import { UserRole } from "./user.model"
import type { IUser } from "./user.model"
import type { IContent } from "./content.model"

// Workflow step type enum
export enum WorkflowStepType {
  REVIEW = "review",
  APPROVAL = "approval",
  CUSTOM = "custom",
}

// Workflow step interface
export interface IWorkflowStep extends Document {
  name: string
  description?: string
  type: WorkflowStepType
  roles: UserRole[]
  isRequired: boolean
  order: number
}

// Workflow interface
export interface IWorkflow extends Document {
  name: string
  description?: string
  contentTypes: string[] | any[]
  steps: IWorkflowStep[]
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

// Workflow entry status enum
export enum WorkflowEntryStatus {
  IN_PROGRESS = "inProgress",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELED = "canceled",
}

// Workflow step entry interface
export interface IWorkflowStepEntry extends Document {
  step: IWorkflowStep | string
  status: WorkflowEntryStatus
  assignedTo?: (IUser | string)[]
  completedBy?: IUser | string
  completedAt?: Date
  comments?: string
  createdAt: Date
}

// Workflow entry interface
export interface IWorkflowEntry extends Document {
  workflow: IWorkflow | string
  content: IContent | string
  status: WorkflowEntryStatus
  currentStep?: IWorkflowStep | string
  steps: IWorkflowStepEntry[]
  createdAt: Date
  updatedAt: Date
}

// Workflow step schema
const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(WorkflowStepType),
      required: true,
    },
    roles: {
      type: [String],
      enum: Object.values(UserRole),
      required: true,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { _id: true },
)

// Workflow schema
const workflowSchema = new Schema<IWorkflow>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    contentTypes: {
      type: [Schema.Types.ObjectId],
      ref: "ContentType",
      default: [],
    },
    steps: {
      type: [workflowStepSchema],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Workflow step entry schema
const workflowStepEntrySchema = new Schema<IWorkflowStepEntry>(
  {
    step: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowStep",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WorkflowEntryStatus),
      default: WorkflowEntryStatus.IN_PROGRESS,
    },
    assignedTo: {
      type: [Schema.Types.ObjectId],
      ref: "User",
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: {
      type: Date,
    },
    comments: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
)

// Workflow entry schema
const workflowEntrySchema = new Schema<IWorkflowEntry>(
  {
    workflow: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
    },
    content: {
      type: Schema.Types.ObjectId,
      ref: "Content",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WorkflowEntryStatus),
      default: WorkflowEntryStatus.IN_PROGRESS,
    },
    currentStep: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowStep",
    },
    steps: {
      type: [workflowStepEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

// Create and export the models
export const WorkflowModel = mongoose.model<IWorkflow>("Workflow", workflowSchema)
export const WorkflowEntryModel = mongoose.model<IWorkflowEntry>("WorkflowEntry", workflowEntrySchema)
