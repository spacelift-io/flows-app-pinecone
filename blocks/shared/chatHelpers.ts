import { events, kv } from "@slflows/sdk/v1";

// Shared helper functions for Pinecone chat blocks

// KV Storage helpers
export const saveConversation = async (
  conversationId: string,
  messages: any[],
  ttl: number,
) => {
  await kv.block.set({
    key: conversationId,
    value: messages,
    ttl,
  });
};

export const getConversation = async (conversationId: string) => {
  const { value } = await kv.block.get(conversationId);
  return value as any[] | undefined;
};

// Error handling helpers
export const formatError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

// Event emission helpers
export const emitSuccess = async (
  data: any,
  pendingEventId: string,
  parentEventId: string,
) => {
  await events.emit(data, { complete: pendingEventId, parentEventId });
};

export const emitError = async (
  error: unknown,
  conversationId: string,
  pendingEventId: string,
  parentEventId: string,
) => {
  await events.cancelPending(pendingEventId, `Processing error: ${error}`);
  await events.emit(
    {
      error: formatError(error),
      conversationId,
    },
    { outputKey: "assistantError", parentEventId },
  );
};

// For rawChat - simpler error emission that throws
export const emitErrorAndThrow = async (
  error: unknown,
  pendingEventId: string,
) => {
  await events.cancelPending(pendingEventId, `Processing error: ${error}`);
  throw error;
};

// Chat parameters builder for rawChat
export const buildChatParams = (
  messages: any[],
  model: string,
  config: any,
) => {
  const chatParams: any = { messages, model };

  if (config.temperature !== undefined) {
    chatParams.temperature = config.temperature;
  }
  if (config.filter) {
    chatParams.filter = config.filter;
  }
  if (config.jsonResponse) {
    chatParams.jsonResponse = config.jsonResponse;
  }
  if (config.includeHighlights) {
    chatParams.includeHighlights = config.includeHighlights;
  }
  if (config.topK !== undefined) {
    chatParams.topK = config.topK;
  }
  if (config.contextOptions) {
    chatParams.contextOptions = config.contextOptions;
  }

  return chatParams;
};
