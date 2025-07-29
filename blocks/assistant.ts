import { AppBlock } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";

interface Signals {
  status?: string;
  host?: string;
}

export const assistant: AppBlock = {
  name: "Assistant",
  category: "Assistant resources",
  description: "Manages a Pinecone Assistant instance resource",
  config: {
    name: {
      name: "Assistant name",
      description: "The name of the Pinecone Assistant",
      type: "string",
      required: true,
      fixed: true,
    },
    instructions: {
      name: "Instructions",
      description: "The instructions for the assistant",
      type: "string",
      required: true,
    },
    region: {
      name: "Region",
      description: "The region where the assistant will be deployed",
      type: {
        type: "string",
        enum: ["us", "eu"],
      },
      required: false,
      fixed: true,
      default: "us",
    },
    metadata: {
      name: "Metadata",
      description: "Additional metadata for the assistant",
      type: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      required: false,
      default: {},
    },
  },

  signals: {
    name: {
      name: "Name",
      description: "The name of the assistant",
    },
    status: {
      name: "Status",
      description: "The current status of the assistant",
    },
    host: {
      name: "Host",
      description: "The host URL for the assistant",
    },
  },

  onSync: async ({ app, block }) => {
    const { name, region, instructions, metadata } = block.config;
    const { apiKey } = app.config;
    const { status } = block.lifecycle?.signals || ({} as Signals);

    const pinecone = new Pinecone({ apiKey });

    // Check if this is a new creation (no status signal) or an instruction update
    if (!status) {
      // New creation - create the assistant
      try {
        const assistantData = await pinecone.createAssistant({
          name,
          instructions,
          metadata,
          region,
        });

        return {
          newStatus: "in_progress",
          signalUpdates: {
            status: assistantData.status,
            host: assistantData.host,
            name,
          },
          customStatusDescription: "Initializing...",
          nextScheduleDelay: 10,
        };
      } catch (error) {
        console.error("Failed to create assistant:", error);
        return {
          newStatus: "failed",
          customStatusDescription: `Creation failed: ${error}`,
        };
      }
    }

    // Check if instructions or metadata have changed
    if (status === "Ready") {
      try {
        const currentAssistant = await pinecone.describeAssistant(name);

        const instructionsChanged =
          currentAssistant.instructions !== instructions;
        const metadataChanged =
          JSON.stringify(currentAssistant.metadata || {}) !==
          JSON.stringify(metadata || {});

        if (instructionsChanged || metadataChanged) {
          // Update instructions and/or metadata
          await pinecone.updateAssistant(name, { instructions, metadata });

          return { newStatus: "ready" };
        }

        // No changes needed, assistant is ready
        return { newStatus: "ready" };
      } catch (error) {
        console.error("Failed to update assistant:", error);
        return {
          newStatus: "failed",
          customStatusDescription: `Update failed: ${error}`,
        };
      }
    }

    // Check status if still initializing
    if (status === "Initializing") {
      try {
        const assistantData = await pinecone.describeAssistant(name);

        if (assistantData.status === "Ready") {
          return {
            newStatus: "ready",
            signalUpdates: {
              status: assistantData.status,
              host: assistantData.host,
            },
          };
        }

        if (assistantData.status === "Initializing") {
          return {
            newStatus: "in_progress",
            signalUpdates: {
              status: assistantData.status,
              host: assistantData.host,
            },
            customStatusDescription: "Still initializing...",
            nextScheduleDelay: 10,
          };
        }

        // Status is Failed or some other error state
        console.error(`Assistant failed with status: ${assistantData.status}`);
        return {
          newStatus: "failed",
          signalUpdates: {
            status: assistantData.status,
            host: assistantData.host,
          },
          customStatusDescription: `Assistant failed: ${assistantData.status}`,
        };
      } catch (error) {
        console.error("Failed to check assistant status:", error);
        return {
          newStatus: "failed",
          customStatusDescription: `Status check failed: ${error}`,
        };
      }
    }

    // Should not reach here, but handle unknown states
    return {
      newStatus: "failed",
      customStatusDescription: `Unknown status: ${status}`,
    };
  },

  onDrain: async ({ app, block }) => {
    const { name } = block.config;
    const { apiKey } = app.config;

    const pinecone = new Pinecone({ apiKey });

    try {
      await pinecone.deleteAssistant(name);
      return { newStatus: "drained" };
    } catch (error) {
      console.error("Failed to delete assistant during drain:", error);
      return {
        newStatus: "draining_failed",
        customStatusDescription: "Failed to delete assistant, see logs",
      };
    }
  },
};
