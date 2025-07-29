import { AppBlock } from "@slflows/sdk/v1";
import { Pinecone } from "@pinecone-database/pinecone";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface Signals {
  contentHash?: string;
  fileId?: string;
  status?: string;
}

export const dataFile: AppBlock = {
  name: "Data file",
  category: "Assistant resources",
  description: "Data file resource for the Pinecone Assistant",
  config: {
    assistantName: {
      name: "Assistant name",
      description: "The name of the Pinecone Assistant to upload the file to",
      type: "string",
      required: true,
      fixed: true,
    },

    content: {
      name: "File content",
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

  signals: {
    status: {
      name: "Status",
      description: "The status of the file upload",
    },
    fileId: {
      name: "File ID",
      description: "The ID of the uploaded file in Pinecone",
    },
    contentHash: {
      name: "Content Hash",
      description: "A hash of the file and metadata content to detect changes",
    },
  },

  onSync: async ({ app, block }) => {
    const { assistantName, content, filename, metadata } = block.config;
    const { apiKey } = app.config;
    const { contentHash, fileId, status } =
      block.lifecycle?.signals || ({} as Signals);

    const assistant = new Pinecone({ apiKey }).Assistant(assistantName);

    let shouldCreate: boolean = false;
    let shouldDelete: boolean = false;
    let shouldCheck: boolean = false;

    if (!contentHash) {
      shouldCreate = true;
    } else if (
      calculateContentHash(content, filename, metadata) !== contentHash
    ) {
      shouldDelete = true;
      shouldCreate = true;
    } else if (status === "Processing") {
      shouldCheck = true;
    }

    if (shouldDelete) {
      try {
        await assistant.deleteFile(fileId as string);
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    }

    if (shouldCreate) {
      const path = writeStringToTempFile(content, filename);

      try {
        const { id, status } = await assistant.uploadFile({ path, metadata });

        // Clean up temporary file
        try {
          fs.unlinkSync(path);
        } catch (cleanupError) {
          console.warn("Failed to clean up temporary file:", cleanupError);
        }

        return {
          newStatus: "in_progress",
          signalUpdates: {
            fileId: id,
            contentHash: calculateContentHash(content, filename, metadata),
            status: status,
          },
          customStatusDescription: "File uploaded, processing...",
          nextScheduleDelay: 15,
        };
      } catch (error) {
        // Clean up temporary file on error too
        try {
          fs.unlinkSync(path);
        } catch (cleanupError) {
          console.warn(
            "Failed to clean up temporary file after error:",
            cleanupError,
          );
        }

        console.error("Upload failed:", error);
        return {
          newStatus: "failed",
          customStatusDescription: `Upload failed: ${error}`,
        };
      }
    }

    if (!shouldCheck) {
      if (status === "Available") {
        return { newStatus: "ready" };
      } else if (status !== "Processing") {
        return {
          newStatus: "failed",
          customStatusDescription: `Unexpected status: ${status}`,
        };
      }

      return {};
    }

    try {
      const details = await assistant.describeFile(fileId as string);

      if (details.status === "Processing") {
        return {
          newStatus: "in_progress",
          customStatusDescription: `Processing in progress (${(details.percentDone || 0) * 100}%)`,
          nextScheduleDelay: 15,
        };
      }

      if (details.status === "Available") {
        return {
          newStatus: "ready",
          signalUpdates: { status: details.status },
        };
      }

      console.error(
        `File processing failed with status ${details.status}: ${details.errorMessage}`,
      );

      return {
        newStatus: "failed",
        customStatusDescription: "Processing failed, see logs",
      };
    } catch (error) {
      console.error("Failed to check file status:", error);
      return {
        newStatus: "failed",
        customStatusDescription: `Status check failed: ${error}`,
      };
    }
  },

  onDrain: async ({ app, block }) => {
    const pinecone = new Pinecone({ apiKey: app.config.apiKey });
    const fileId = block.lifecycle?.signals?.fileId as string;

    if (!fileId) {
      return { newStatus: "drained" };
    }

    try {
      await pinecone.Assistant(block.config.assistantName).deleteFile(fileId);
      return { newStatus: "drained" };
    } catch (error) {
      console.error("Failed to delete file during drain:", error);
      return {
        newStatus: "draining_failed",
        customStatusDescription: "See logs for details",
      };
    }
  },
};

function calculateContentHash(
  content: string,
  filename?: string,
  metadata: any = {},
): string {
  // Include content, filename, and metadata in hash calculation
  const combined = content + (filename || "") + JSON.stringify(metadata || {});

  // Simple hash function for content comparison that returns a hex string
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex string for better readability
  return Math.abs(hash).toString(16);
}

function writeStringToTempFile(content: string, filename?: string): string {
  // Use provided filename or generate a random one
  const tempFilename = filename || `data-${crypto.randomUUID()}.txt`;
  const filePath = path.join(os.tmpdir(), tempFilename);

  // Write content to temp file
  fs.writeFileSync(filePath, content, "utf8");

  return filePath;
}
