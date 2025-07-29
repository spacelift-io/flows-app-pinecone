import { AppBlock, events } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";

export const updateAssistant: AppBlock = {
  name: "Update Assistant",
  category: "Assistant operations",
  description: "Update a Pinecone Assistant's instructions and metadata",
  config: {
    assistantName: {
      name: "Assistant Name",
      description: "The name of the Pinecone Assistant to update",
      type: "string",
      required: true,
    },
  },

  inputs: {
    default: {
      config: {
        instructions: {
          name: "Instructions",
          description: "New instructions for the assistant",
          type: "string",
          required: false,
        },
        metadata: {
          name: "Metadata",
          description: "New metadata for the assistant",
          type: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          required: false,
        },
      },
      onEvent: async ({ app, block, event }) => {
        const { assistantName } = block.config;
        const { instructions, metadata } = event.inputConfig;

        if (!instructions && !metadata) {
          throw new Error(
            "At least one of instructions or metadata must be provided",
          );
        }

        const pinecone = new Pinecone({ apiKey: app.config.apiKey });

        const pendingId = await events.createPending({
          outputId: "default",
          statusDescription: "Updating assistant...",
          event: { assistantName },
        });

        try {
          // Build update payload with only provided fields
          const updatePayload: any = {};
          if (instructions !== undefined) {
            updatePayload.instructions = instructions;
          }
          if (metadata !== undefined) {
            updatePayload.metadata = metadata;
          }

          await pinecone.updateAssistant(assistantName, updatePayload);

          // Get updated assistant details
          const updatedAssistant =
            await pinecone.describeAssistant(assistantName);

          await events.emit(
            {
              assistantName,
              instructions: updatedAssistant.instructions,
              metadata: updatedAssistant.metadata,
              status: updatedAssistant.status,
              updated: true,
            },
            { complete: pendingId },
          );
        } catch (error) {
          await events.cancelPending(pendingId, `Update failed: ${error}`);
          throw error;
        }
      },
    },
  },

  outputs: {
    default: {
      name: "Update success",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          assistantName: {
            type: "string",
            description: "The name of the updated assistant",
          },
          instructions: {
            type: "string",
            description: "The current instructions of the assistant",
          },
          metadata: {
            type: "object",
            description: "The current metadata of the assistant",
          },
          status: {
            type: "string",
            description: "The current status of the assistant",
          },
          updated: {
            type: "boolean",
            description: "Confirmation that the assistant was updated",
          },
        },
        required: ["assistantName", "updated"],
      },
    },
  },
};
