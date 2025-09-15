import mongoose, { type Document, Schema } from "mongoose"
import bcrypt from "bcryptjs"

// User roles
export enum UserRole {
  ADMIN = "admin",
  EDITOR = "editor",
  AUTHOR = "author",
  VIEWER = "viewer",
}

// User interface
export interface IUser extends Document {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

// User schema
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.VIEWER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

// Virtual for full name
userSchema.virtual("fullName").get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`
})

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next()

  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10)

    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error: any) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

// Create and export the model
export const UserModel = mongoose.model<IUser>("User", userSchema)
