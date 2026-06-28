import { Schema, model, models } from "mongoose";

const CollaboratorSchema =
  new Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      role: {
        type: String,

        enum: [
          "OWNER",
          "EDITOR",
          "VIEWER",
        ],

        default: "VIEWER",
      },

      invitedAt: {
        type: Date,
        default: Date.now,
      },
    },

    {
      _id: false,
    }
  );

const DocumentSchema = new Schema(
  {
    title: {
      type: String,

      default: "Untitled Document",
    },

    content: {
      type: String,

      default: "",
    },

    owner: {
      type: Schema.Types.ObjectId,

      ref: "User",

      required: true,
    },

    collaborators: [
      CollaboratorSchema,
    ],

    lastEditedBy: {
      type: Schema.Types.ObjectId,

      ref: "User",
    },

    lastSavedAt: {
      type: Date,
    },

    revision: {
      type: Number,
      default: 0,
    },
  },

  {
    timestamps: true,
  }
);

DocumentSchema.index({
  owner: 1,
});

DocumentSchema.index({
  "collaborators.user": 1,
});

DocumentSchema.index({
  updatedAt: -1,
});

DocumentSchema.index({
  title: "text",
});

const Document =
  models.Document ||
  model("Document", DocumentSchema);

export default Document;
