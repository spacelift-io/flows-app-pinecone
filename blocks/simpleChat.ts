import { AppBlock, events, messaging } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  saveConversation,
  getConversation,
  emitSuccess,
  emitError,
} from "./shared/chatHelpers";

export const simpleChat: AppBlock = {
  name: "Simple chat",
  category: "Assistant operations",
  description:
    "Simple chat with a Pinecone Assistant, with managed conversation history",
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
    ttl: {
      name: "Conversation TTL",
      description: "Time to live for conversation data in seconds",
      type: "number",
      default: 3600, // Default to 1 hour
      required: false,
    },
    timeout: {
      name: "Request Timeout",
      description: "Timeout for assistant API calls in seconds",
      type: "number",
      default: 30,
      required: false,
    },
  },

  inputs: {
    default: {
      config: {
        userMessage: {
          name: "Message",
          description: "The message to send to the assistant",
          type: "string",
          required: true,
        },
        conversationId: {
          name: "Conversation ID",
          description:
            "The ID of the conversation to continue (optional). If not provided, " +
            "or provided and not found, a new conversation will be started with this ID.",
          type: "string",
          required: false,
        },
      },
      onEvent: async ({ block, event }) => {
        let { userMessage, conversationId } = event.inputConfig;

        let messages: any[] = [];
        let continued: boolean = false;

        if (conversationId) {
          const existingMessages = await getConversation(conversationId);
          if (existingMessages !== undefined) {
            continued = true;
            messages = existingMessages;
          }
        } else {
          conversationId = crypto.randomUUID();
        }

        messages.push({ role: "user", content: userMessage });
        await saveConversation(conversationId, messages, block.config.ttl);

        const pendingEventId = await events.createPending({
          outputId: "default",
          statusDescription: "Assistant response in progress",
          event: { conversationId, continued },
        });

        await messaging.sendToBlocks({
          body: {
            conversationId,
            continued,
            messages,
            parentEventId: event.id,
            pendingEventId,
          },
          blockIds: [block.id],
        });
      },
    },
  },

  onInternalMessage: async ({ app, block, message: msg }) => {
    const {
      conversationId,
      continued,
      messages,
      parentEventId,
      pendingEventId,
    } = msg.body;
    const { assistantId, model } = block.config;
    const pinecone = new Pinecone({ apiKey: app.config.apiKey });
    const assistant = pinecone.assistant(assistantId);

    try {
      const { message } = await assistant.chat({ messages, model });
      messages.push(message);

      await saveConversation(conversationId, messages, block.config.ttl);

      await emitSuccess(
        { response: message?.content, conversationId, continued },
        pendingEventId,
        parentEventId,
      );
    } catch (error) {
      // Clean up pending event and emit error on secondary channel
      await emitError(error, conversationId, pendingEventId, parentEventId);
    }
  },

  outputs: {
    default: {
      name: "Assistant response",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "The assistant's response message",
          },
          continued: {
            type: "boolean",
            description: "Indicates if the conversation was continued",
          },
          conversationId: {
            type: "string",
            description: "The conversation ID for continuing the conversation",
          },
        },
        required: ["response", "conversationId", "continued"],
      },
    },
    assistantError: {
      name: "Assistant error",
      possiblePrimaryParents: ["default"],
      secondary: true,
      type: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message",
          },
          conversationId: {
            type: "string",
            description: "The conversation ID where the error occurred",
          },
        },
        required: ["error", "conversationId"],
      },
    },
  },
};
