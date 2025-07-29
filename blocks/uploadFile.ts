import { AppBlock, events, timers } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const uploadFile: AppBlock = {
  name: "Upload File",
  category: "Assistant operations",
  description:
    "Upload a file to a Pinecone Assistant and wait for processing to complete",
  config: {
    assistantName: {
      name: "Assistant Name",
      description: "The name of the Pinecone Assistant to upload to",
      type: "string",
      required: true,
    },
  },

  inputs: {
    default: {
      config: {
        content: {
          name: "File Content",
          description: "The content of the file to upload",
          type: "string",
          required: true,
        },
        filename: {
          name: "Filename",
          description: "The filename to use for the uploaded file",
          type: "string",
          required: false,
        },
        metadata: {
          name: "Metadata",
          description: "Additional metadata for the file",
          type: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          required: false,
          default: {},
        },
      },
      onEvent: async ({ app, block, event }) => {
        const { assistantName } = block.config;
        const { content, filename, metadata } = event.inputConfig;

        const pinecone = new Pinecone({ apiKey: app.config.apiKey });
        const assistant = pinecone.Assistant(assistantName);

        let tempFilePath: string | null = null;

        try {
          // Write content to temporary file
          tempFilePath = writeStringToTempFile(content, filename);

          // Upload the file
          const { id } = await assistant.uploadFile({
            path: tempFilePath,
            metadata: metadata || {},
          });

          // Create pending event and start checking
          const pendingId = await events.createPending({
            outputId: "default",
            statusDescription: "Checking file status...",
            event: {
              fileId: id,
              contentLength: content.length,
              uploadedMetadata: metadata || {},
            },
          });

          // Start status checking with timer
          await timers.set(5, {
            inputPayload: {
              assistantName,
              pendingId,
              fileId: id,
              contentLength: content.length,
              uploadedMetadata: metadata || {},
            },
            pendingEventId: pendingId,
            description: `Checking status for file ${id}`,
          });
        } catch (error) {
          throw error;
        } finally {
          // Clean up temporary file
          if (tempFilePath) {
            try {
              fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
              console.warn("Failed to clean up temporary file:", cleanupError);
            }
          }
        }
      },
    },
  },

  onTimer: async ({ app, timer }) => {
    const {
      assistantName,
      pendingId,
      fileId,
      contentLength,
      uploadedMetadata,
    } = timer.payload;

    try {
      const pinecone = new Pinecone({ apiKey: app.config.apiKey });
      const assistant = pinecone.Assistant(assistantName);
      const fileDetails = await assistant.describeFile(fileId);

      if (fileDetails.status === "Processing") {
        const progressPercent = (fileDetails.percentDone || 0) * 100;
        await events.updatePending(pendingId, {
          statusDescription: `Processing file... ${progressPercent.toFixed(1)}% complete`,
        });

        // Schedule next check in 15 seconds
        await timers.set(15, {
          inputPayload: {
            assistantName,
            pendingId,
            fileId,
            contentLength,
            uploadedMetadata,
          },
          pendingEventId: pendingId,
          description: `Checking status for file ${fileId}`,
        });
        return;
      }

      // File is no longer processing, complete the pending event with final result
      await events.emit(
        {
          fileId: fileDetails.id,
          name: fileDetails.name,
          status: fileDetails.status,
          metadata: fileDetails.metadata || uploadedMetadata,
          contentLength,
          percentDone: fileDetails.percentDone,
          errorMessage: fileDetails.errorMessage,
          createdOn: fileDetails.createdOn,
          updatedOn: fileDetails.updatedOn,
        },
        { complete: pendingId },
      );
    } catch (error) {
      await events.cancelPending(
        pendingId,
        `Failed to check file status: ${error}`,
      );
      throw error;
    }
  },

  outputs: {
    default: {
      name: "Upload complete",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          fileId: {
            type: "string",
            description: "The ID of the uploaded file",
          },
          name: {
            type: "string",
            description: "The name of the file",
          },
          status: {
            type: "string",
            description: "The final status of the file",
          },
          metadata: {
            type: "object",
            description: "The metadata associated with the file",
          },
          contentLength: {
            type: "number",
            description: "The length of the uploaded content",
          },
          percentDone: {
            type: "number",
            description: "The percentage of processing completed",
          },
          errorMessage: {
            type: "string",
            description: "Error message if processing failed",
          },
          createdOn: {
            type: "string",
            description: "When the file was created",
          },
          updatedOn: {
            type: "string",
            description: "When the file was last updated",
          },
        },
        required: ["fileId", "name", "status", "contentLength"],
      },
    },
  },
};

function writeStringToTempFile(content: string, filename?: string): string {
  const tempFilename = filename || `upload-${crypto.randomUUID()}.txt`;
  const filePath = path.join(os.tmpdir(), tempFilename);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}
