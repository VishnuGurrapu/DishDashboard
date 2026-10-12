import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IDish {
  dishId: string
  dishName: string
  imageUrl: string
  isPublished: boolean
  version: number
  createdAt?: Date
  updatedAt?: Date
}

export interface IDishDocument extends IDish, Document {}

const dishSchema = new Schema<IDishDocument>(
  {
    dishId: {
      type: String,
      required: [true, 'dishId is required'],
      unique: true,
      trim: true,
      index: true,
    },
    dishName: {
      type: String,
      required: [true, 'dishName is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'imageUrl is required'],
      trim: true,
    },
    isPublished: {
      type: Boolean,
      required: [true, 'isPublished is required'],
      default: false,
    },
    version: {
      type: Number,
      required: [true, 'version is required'],
      default: 1,
      min: [1, 'version must be at least 1'],
    },
  },
  {
    timestamps: true,
    versionKey: false, // Use our explicit business logic version field
  }
)

export const Dish: Model<IDishDocument> =
  mongoose.models.Dish || mongoose.model<IDishDocument>('Dish', dishSchema)
