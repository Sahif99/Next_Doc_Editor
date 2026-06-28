import { Schema, model, models } from "mongoose";

const VersionSchema =
  new Schema(
    {
      document: {
        type: Schema.Types.ObjectId,

        ref: "Document",

        required: true,
      },

      content: {
        type: String,

        default: "",
      },

      title: {
        type: String,

        required: true,
      },

      label: {
        type: String,

        default: "Auto-save",
      },

      createdBy: {
        type: Schema.Types.ObjectId,

        ref: "User",

        required: true,
      },
    },

    {
      timestamps: true,
    }
  );

VersionSchema.index({
  document: 1,
});

VersionSchema.index({
  createdAt: -1,
});

const Version =
  models.Version ||
  model("Version", VersionSchema);

export default Version;
