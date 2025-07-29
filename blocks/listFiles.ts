import { AppBlock, events } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";

export const listFiles: AppBlock = {
  name: "List Files",
  category: "Assistant operations",
  description: "List all files in a Pinecone Assistant",
  config: {
    assistantName: {
      name: "Assistant Name",
      description: "The name of the Pinecone Assistant to list files from",
      type: "string",
      required: true,
    },
  },

  inputs: {
    default: {
      config: {},
      onEvent: async ({ app, block }) => {
        const { assistantName } = block.config;

        const pinecone = new Pinecone({ apiKey: app.config.apiKey });
        const assistant = pinecone.Assistant(assistantName);

        const pendingId = await events.createPending({
          outputId: "default",
          statusDescription: "Listing files...",
          event: {},
        });

        try {
          const { files } = await assistant.listFiles();

          await events.emit(
            {
              files: files?.map((file) => ({
                id: file.id,
                name: file.name,
                status: file.status,
                metadata: file.metadata,
                createdOn: file.createdOn,
                updatedOn: file.updatedOn,
                percentDone: file.percentDone,
                signedUrl: file.signedUrl,
                errorMessage: file.errorMessage,
              })),
            },
            { complete: pendingId },
          );
        } catch (error) {
          await events.cancelPending(pendingId, `List failed: ${error}`);
          throw error;
        }
      },
    },
  },

  outputs: {
    default: {
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          files: {
            type: "array",
            description: "List of files in the assistant",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                status: { type: "string" },
                metadata: { type: "object" },
                createdOn: { type: "string" },
                updatedOn: { type: "string" },
                percentDone: { type: "number" },
                signedUrl: { type: "string" },
                errorMessage: { type: "string" },
              },
              required: ["id", "name"],
            },
          },
        },
        required: ["files"],
      },
    },
  },
};
