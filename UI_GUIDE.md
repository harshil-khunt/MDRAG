# LLM Provider Selection UI Guide

## How Users Select AI Provider

### 1. Create Workspace Flow

When users click **"Create Workspace"**, they see a modal with:

#### Step 1: Enter Workspace Name
```
┌─────────────────────────────────────────┐
│  Workspace Name                         │
│  ┌───────────────────────────────────┐  │
│  │ Enter workspace name              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Step 2: Choose AI Provider

Two beautiful cards to choose from:

```
┌─────────────────────────────────────────────────────┐
│  Choose AI Provider                                 │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ ⚡ Google Gemini                    [Selected] │ │
│  │                                                │ │
│  │ Model: gemini-2.5-flash                       │ │
│  │ Embedding: text-embedding-004                 │ │
│  │ Fast, reliable, and cost-effective            │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🤖 OpenAI                                      │ │
│  │                                                │ │
│  │ Model: gpt-5-mini                             │ │
│  │ Embedding: text-embedding-3-small             │ │
│  │ Advanced reasoning and understanding          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  💡 Note: The AI provider cannot be changed after  │
│     workspace creation. All documents, embeddings, │
│     and chat will use the selected provider.       │
└─────────────────────────────────────────────────────┘
```

### 2. Visual Design Features

#### Selected State
- **Gemini Selected**: Blue border (border-blue-500) + light blue background (bg-blue-50)
- **OpenAI Selected**: Green border (border-green-500) + light green background (bg-green-50)

#### Icons
- **Gemini**: ⚡ ThunderboltOutlined (blue)
- **OpenAI**: 🤖 RobotOutlined (green)

#### Interactive
- Click anywhere on the card to select
- Radio button inside card
- Hover effect on unselected cards

### 3. Workspace List Display

After creation, workspace cards show AI provider badge:

```
┌─────────────────────────┐
│    📁                   │
│  My Workspace           │
│  ID: abc12345...        │
│                         │
│  [⚡ Google Gemini]     │  ← Blue badge
│                         │
│  [Open]  [Remove]       │
└─────────────────────────┘

┌─────────────────────────┐
│    📁                   │
│  AI Workspace           │
│  ID: def67890...        │
│                         │
│  [🤖 OpenAI]            │  ← Green badge
│                         │
│  [Open]  [Remove]       │
└─────────────────────────┘
```

## User Experience Flow

### Creating a Workspace

1. **User clicks** "Create Workspace" button
2. **Modal opens** with name input and AI provider selection
3. **User enters** workspace name
4. **User selects** AI provider (Gemini or OpenAI) by clicking card
5. **Selected card** highlights with colored border and background
6. **User clicks** "Create" button
7. **Success message** shows: "Workspace created with Google Gemini!" or "Workspace created with OpenAI!"
8. **Workspace appears** in list with AI provider badge

### Viewing Workspaces

- Each workspace card shows:
  - Workspace name
  - Workspace ID (truncated)
  - **AI Provider badge** (Gemini = blue, OpenAI = green)
  - Open and Remove buttons

### Important Notes

- **Cannot change** AI provider after workspace creation
- **All operations** (file uploads, URL crawling, chat) use workspace's AI provider
- **Embeddings** are provider-specific and stored separately
- **Badge color coding**:
  - 🔵 Blue = Gemini
  - 🟢 Green = OpenAI

## Technical Implementation

### Frontend Components

**WorkspaceList.tsx**
- State: `llmProvider` (gemini | openai)
- Default: 'gemini'
- Radio.Group with Card selection
- Visual feedback on selection
- Sends `llmProvider` to API

**API Service (api.ts)**
- Updated `createWorkspace()` to accept `llmProvider` parameter
- Sends to backend: `{ name, owner, llmProvider }`

### Backend Processing

**Server (server.js)**
- Receives `llmProvider` in POST /workspaces
- Validates: 'gemini' or 'openai'
- Passes to `createWorkspace()`

**Database (database.js)**
- Stores in workspace document:
  - `llm_provider`: 'gemini' or 'openai'
  - `llm_model`: 'gemini-2.5-flash' or 'gpt-5-mini'
  - `embedding_model`: 'text-embedding-004' or 'text-embedding-3-small'

**Usage**
- All embeddings use workspace's `embedding_model`
- All chat uses workspace's `llm_model`
- All processing respects workspace's AI provider

## Screenshots (Conceptual)

### Modal - Gemini Selected
```
┌──────────────────────────────────────────────┐
│  Create New Workspace                    [X] │
├──────────────────────────────────────────────┤
│                                              │
│  Workspace Name                              │
│  ┌────────────────────────────────────────┐  │
│  │ My AI Workspace                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Choose AI Provider                          │
│                                              │
│  ╔════════════════════════════════════════╗  │
│  ║ ⚡ Google Gemini              ● Selected║  │
│  ║                                        ║  │
│  ║ Model: gemini-2.5-flash               ║  │
│  ║ Embedding: text-embedding-004         ║  │
│  ║ Fast, reliable, and cost-effective    ║  │
│  ╚════════════════════════════════════════╝  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 🤖 OpenAI                      ○       │  │
│  │                                        │  │
│  │ Model: gpt-5-mini                     │  │
│  │ Embedding: text-embedding-3-small     │  │
│  │ Advanced reasoning and understanding  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  💡 Note: The AI provider cannot be changed │
│     after workspace creation.                │
│                                              │
│                        [Cancel]  [Create]    │
└──────────────────────────────────────────────┘
```

### Workspace Card with Badge
```
┌─────────────────────────────────┐
│                                 │
│           📁                    │
│                                 │
│      My AI Workspace            │
│                                 │
│      ID: abc12345...            │
│                                 │
│    ┌─────────────────┐          │
│    │ ⚡ Google Gemini │          │
│    └─────────────────┘          │
│                                 │
├─────────────────────────────────┤
│   [📂 Open]    [🗑️ Remove]     │
└─────────────────────────────────┘
```

## Benefits

✅ **Clear Visual Distinction**: Users immediately see which AI powers each workspace
✅ **Informed Choice**: Model details shown before selection
✅ **No Confusion**: Cannot change after creation (prevents mixing embeddings)
✅ **Beautiful UI**: Card-based selection with colors and icons
✅ **Persistent Display**: Badge always visible on workspace cards
