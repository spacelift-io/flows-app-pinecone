import { defineApp } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";
import { assistant } from "./blocks/assistant";
import { retrieveSnippets } from "./blocks/retrieveSnippets";
import { dataFile } from "./blocks/dataFile";
import { rawChat } from "./blocks/rawChat";
import { simpleChat } from "./blocks/simpleChat";
import { uploadFile } from "./blocks/uploadFile";
import { deleteFile } from "./blocks/deleteFile";
import { listFiles } from "./blocks/listFiles";
import { updateAssistant } from "./blocks/updateAssistant";

export const app = defineApp({
  name: "Pinecone Assistant",
  installationInstructions:
    "To connect your Pinecone account:\n1. **Get API Key**: Visit https://app.pinecone.io/ and create an API key\n2. **Configure**: Paste your API key in the 'Pinecone API Key' field below\n3. **Confirm**: Click 'Confirm' to complete the installation",
  config: {
    apiKey: {
      name: "Pinecone API Key",
      description: "Your Pinecone API key",
      type: "string",
      required: true,
      sensitive: true,
    },
  },
  blocks: {
    // Resources
    assistant,
    dataFile,

    // Actions
    chat: simpleChat,
    context: retrieveSnippets,
    rawChat,
    uploadFile,
    deleteFile,
    listFiles,
    updateAssistant,
  },
  async onSync(input) {
    const { apiKey } = input.app.config;

    if (!apiKey) {
      return {
        newStatus: "failed",
        customStatusDescription: "Pinecone API Key is required.",
      };
    }

    try {
      // Test the connection by creating a client instance and listing assistants.
      await new Pinecone({ apiKey }).listAssistants();
      return { newStatus: "ready" };
    } catch (error) {
      console.error("Failed to validate Pinecone API Key: ", error);

      return {
        newStatus: "failed",
        customStatusDescription: `Check logs for details`,
      };
    }
  },
});
