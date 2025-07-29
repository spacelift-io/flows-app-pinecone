import { AppBlock, events } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";

export const retrieveSnippets: AppBlock = {
  name: "Retrieve snippets",
  category: "Assistant operations",
  description: "Retrieve context snippets from a Pinecone Assistant",
  config: {
    assistantName: {
      name: "Assistant name",
      description:
        "The name of the Pinecone Assistant to retrieve context from",
      type: "string",
      required: true,
    },
    topK: {
      name: "Top K",
      description:
        "The maximum number of context snippets to return (default: 16, max: 64)",
      type: "number",
      required: false,
      default: 16,
    },
  },

  inputs: {
    default: {
      config: {
        messages: {
          name: "Messages",
          description: "Array of message objects for generating context",
          type: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  description: "Role such as 'user' or 'assistant'",
                },
                content: {
                  type: "string",
                  description: "Content of the message",
                },
              },
            },
          },
          required: true,
        },
        filter: {
          name: "Filter",
          description:
            "Metadata filters to control which documents can be retrieved",
          type: {
            type: "object",
          },
          required: false,
        },
      },
      onEvent: async ({ app, block, event }) => {
        const { assistantName, topK } = block.config;
        const { apiKey } = app.config;
        const { messages, filter } = event.inputConfig;

        const assistant = new Pinecone({ apiKey }).Assistant(assistantName);

        const pendingId = await events.createPending({
          outputId: "default",
          statusDescription: "Retrieving context snippets...",
          event: { messages },
        });

        try {
          const contextOptions: any = {
            messages,
            topK,
          };

          if (filter) {
            contextOptions.filter = filter;
          }

          const response = await assistant.context(contextOptions);

          // Emit the response to the default output
          await events.emit({ ...response, messages }, { complete: pendingId });
        } catch (error) {
          // Clean up pending event if there's an error, then rethrow.
          await events.cancelPending(
            pendingId,
            `Context retrieval error: ${error}`,
          );
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
          id: { type: "string" },
          snippets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text"] },
                content: { type: "string" },
                score: { type: "number" },
                reference: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    file: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        status: { type: "string" },
                        size: { type: "integer" },
                        metadata: { type: "object" },
                        created_on: { type: "string" },
                        updated_on: { type: "string" },
                        percent_done: { type: "number" },
                        signed_url: { type: "string" },
                        error_message: { type: "string" },
                      },
                    },
                    pages: {
                      type: "array",
                      items: { type: "integer" },
                    },
                  },
                },
              },
              required: ["content", "score", "reference"],
            },
          },
          usage: {
            type: "object",
            properties: {
              prompt_tokens: { type: "integer" },
              completion_tokens: { type: "integer" },
              total_tokens: { type: "integer" },
            },
            required: ["prompt_tokens", "completion_tokens", "total_tokens"],
          },
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" },
              },
            },
          },
          error: { type: "string" },
        },
        required: ["snippets", "usage"],
      },
    },
  },
};
