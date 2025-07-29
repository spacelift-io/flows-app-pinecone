import { AppBlock, events } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";

export const deleteFile: AppBlock = {
  name: "Delete File",
  category: "Assistant operations",
  description: "Delete a file from a Pinecone Assistant",
  config: {
    assistantName: {
      name: "Assistant Name",
      description: "The name of the Pinecone Assistant to delete from",
      type: "string",
      required: true,
    },
  },

  inputs: {
    default: {
      config: {
        fileId: {
          name: "File ID",
          description: "The ID of the file to delete",
          type: "string",
          required: true,
        },
      },
      onEvent: async ({ app, block, event }) => {
        const { assistantName } = block.config;
        const { fileId } = event.inputConfig;

        const pinecone = new Pinecone({ apiKey: app.config.apiKey });
        const assistant = pinecone.Assistant(assistantName);

        await assistant.deleteFile(fileId);
        await events.emit({ fileId });
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
          fileId: {
            type: "string",
            description: "The ID of the deleted file",
          },
        },
        required: ["fileId"],
      },
    },
  },
};
