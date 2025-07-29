# Pinecone Assistant - Flows App

A Flows app that integrates with Pinecone's Assistant API, enabling you to create AI assistants with context retrieval, file management, and chat capabilities.

## Quick Start

1. **Install dependencies** - `npm install`
2. **Get Pinecone API Key** - Visit https://app.pinecone.io/ and create an API key
3. **Configure** - Add your API key when installing the app in Flows
4. **Deploy** - Use the blocks to create assistants and manage your knowledge base

## App Structure

```
├── main.ts                    # App definition and configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── blocks/                   # Block implementations
│   ├── assistant.ts          # Assistant resource management
│   ├── dataFile.ts          # Data file resource management
│   ├── simpleChat.ts        # Simple chat with assistant
│   ├── rawChat.ts           # Raw chat interface
│   ├── retrieveSnippets.ts  # Context retrieval from knowledge base
│   ├── uploadFile.ts        # Upload files to assistant
│   ├── deleteFile.ts        # Delete files from assistant
│   ├── listFiles.ts         # List assistant files
│   ├── updateAssistant.ts   # Update assistant configuration
│   └── shared/              # Shared utilities
│       └── chatHelpers.ts   # Chat helper functions
└── README.md                # This file
```

## Features

### Available Blocks

#### Resources

- **Assistant** - Create and manage Pinecone assistants
- **Data File** - Manage data files for your assistants

#### Actions

- **Simple Chat** - Chat with your assistant using simple text input/output
- **Raw Chat** - Advanced chat interface with full message control
- **Context Retrieval** - Retrieve relevant snippets from your knowledge base
- **Upload File** - Add files to your assistant's knowledge base
- **Delete File** - Remove files from your assistant
- **List Files** - View all files associated with an assistant
- **Update Assistant** - Modify assistant configuration and instructions

### Configuration

The app requires a single configuration parameter:

- **Pinecone API Key** (required, sensitive) - Your API key from https://app.pinecone.io/

The app automatically validates your API key on installation by attempting to list your assistants.

## Usage Examples

### Basic Workflow

1. **Create an Assistant**
   - Use the Assistant resource block to create a new Pinecone assistant
   - Configure its instructions and model preferences

2. **Upload Knowledge Base**
   - Use Upload File to add documents to your assistant's knowledge base
   - Files are automatically processed and indexed by Pinecone

3. **Chat with Context**
   - Use Simple Chat for basic conversations
   - Use Context Retrieval to get relevant snippets before chatting
   - Use Raw Chat for advanced message handling

4. **Manage Files**
   - Use List Files to see all uploaded documents
   - Use Delete File to remove outdated content
   - Use Update Assistant to modify instructions or settings

### Integration Patterns

The blocks are designed to work together in flows:

- **Context → Chat**: Retrieve relevant context before sending chat messages
- **Upload → List**: Upload files and verify they were added successfully
- **Assistant → Update**: Create an assistant then modify its configuration
- **Chat → Context**: Use chat responses to guide context retrieval

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Available Scripts

```bash
npm run typecheck    # Type checking
npm run format       # Code formatting
```

### Testing Your App

1. Run type checking: `npm run typecheck`
2. Format code: `npm run format`

**Note**: TypeScript may show SDK import errors during development. This is expected - the SDK will be available when the app runs in the Flows environment.

## Architecture

### Pinecone Integration

This app integrates with Pinecone's Assistant API, which provides:

- **Managed AI Assistants** - Pre-configured AI models with custom instructions
- **Knowledge Base** - Automatic file processing and vector indexing
- **Context Retrieval** - Semantic search across your documents
- **Chat Interface** - Conversational AI with RAG (Retrieval Augmented Generation)

### Block Design

Each block is designed for a specific use case:

- **Resource blocks** (Assistant, Data File) manage Pinecone entities
- **Action blocks** provide specific functionality like chat or file operations
- **Shared utilities** in `blocks/shared/` provide common functionality

### Error Handling

The app follows Flows best practices:

- Errors bubble up naturally without wrapping
- Descriptive error messages for debugging
- Automatic API key validation on app installation

## Troubleshooting

### Common Issues

**"Invalid API Key" error**

- Verify your API key is correct at https://app.pinecone.io/
- Check that the key has appropriate permissions
- Ensure the key is properly pasted without extra spaces

**Assistant not found**

- Make sure the assistant exists in your Pinecone account
- Verify you're using the correct assistant ID
- Check that the assistant is properly configured

**File upload failures**

- Ensure file size is within Pinecone's limits
- Check file format is supported
- Verify sufficient quota in your Pinecone account

**Type checking errors**

- Run `npm run typecheck` to identify specific issues
- Ensure all dependencies are installed
- Check that SDK imports are correct

## Dependencies

- **@pinecone-database/pinecone** - Official Pinecone JavaScript SDK
- **@slflows/sdk** - Flows platform SDK
- **TypeScript** - Type safety and development tooling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run typecheck` and `npm run format`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
