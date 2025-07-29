import { AppBlock, events, messaging } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  emitSuccess,
  emitErrorAndThrow,
  buildChatParams,
} from "./shared/chatHelpers";

export const rawChat: AppBlock = {
  name: "Raw chat",
  category: "Assistant operations",
  description: "Raw chat with a Pinecone Assistant, exposing advanced features",
  config: {
    assistantId: {
      name: "Assistant ID",
      description: "The ID of the Pinecone Assistant to chat with",
      type: "string",
      required: true,
    },
    model: {
      name: "Model",
      description: "The model to use for the conversation",
      type: {
        type: "string",
        enum: [
          "gpt-4o",
          "gpt-4.1",
          "o4-mini",
          "claude-3-5-sonnet",
          "claude-3-7-sonnet",
          "gemini-2.5-pro",
        ],
      },
      default: "gpt-4o",
      required: true,
    },
    temperature: {
      name: "Temperature",
      description:
        "Controls the randomness of the model's responses (0.0 to 1.0)",
      type: "number",
      default: 0,
      required: false,
    },
    filter: {
      name: "Filter",
      description:
        "Optionally filter which documents can be retrieved using the following metadata fields.",
      type: {
        type: "object",
        additionalProperties: true,
      },
      required: false,
    },
    jsonResponse: {
      name: "JSON response",
      description:
        "If true, the response will be returned as a JSON object with the response",
      type: "boolean",
      default: false,
      required: false,
    },
    includeHighlights: {
      name: "Include highlights",
      description:
        "If true, the assistant will return highlights from referenced documents",
      type: "boolean",
      default: false,
      required: false,
    },
    topK: {
      name: "Top K",
      description:
        "The maximum number of context snippets to use (1-64, default 16)",
      type: "number",
      default: 16,
      required: false,
    },
    contextOptions: {
      name: "Context options",
      description: "Controls the context snippets sent to the LLM",
      required: false,
      type: {
        type: "object",
        properties: {
          topK: {
            type: "number",
            description: "The maximum number of context snippets to use.",
          },
          snippetSize: {
            type: "number",
            description: "The maximum size of each context snippet in tokens.",
          },
        },
      },
    },
  },

  inputs: {
    default: {
      config: {
        messages: {
          name: "Messages",
          description: "The messages to send to the model",
          type: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  enum: ["user", "assistant"],
                },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          required: true,
        },
      },
      onEvent: async ({ block, event }) => {
        const { messages } = event.inputConfig;

        const pendingEventId = await events.createPending({
          outputId: "default",
          statusDescription: "Assistant response in progress",
          event: {},
        });

        await messaging.sendToBlocks({
          body: { messages, parentEventId: event.id, pendingEventId },
          blockIds: [block.id],
        });
      },
    },
  },

  onInternalMessage: async ({ app, block, message: msg }) => {
    const { messages, parentEventId, pendingEventId } = msg.body;
    const {
      assistantId,
      model,
      temperature,
      filter,
      jsonResponse,
      includeHighlights,
      topK,
      contextOptions,
    } = block.config;

    const pinecone = new Pinecone({ apiKey: app.config.apiKey });
    const assistant = pinecone.assistant(assistantId);

    try {
      const chatParams = buildChatParams(messages, model, {
        temperature,
        filter,
        jsonResponse,
        includeHighlights,
        topK,
        contextOptions,
      });

      const response = await assistant.chat(chatParams);
      await emitSuccess({ ...response }, pendingEventId, parentEventId);
    } catch (error) {
      await emitErrorAndThrow(error, pendingEventId);
    }
  },

  outputs: {
    default: {
      name: "Assistant response",
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          id: { type: "string" },
          finishReason: { type: "string" },
          message: {
            type: "object",
            properties: {
              role: { type: "string" },
              content: { type: "string" },
            },
            required: ["role", "content", "timestamp"],
          },
          model: { type: "string" },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          usage: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: [
          "id",
          "finishReason",
          "message",
          "model",
          "citations",
          "usage",
        ],
      },
    },
  },
};
