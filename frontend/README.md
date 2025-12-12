# AI Assistant Frontend

A modern, user-friendly React frontend for the AI Assistant API - Intelligent Document & URL Analysis platform.

## Features

- 🚀 **Workspace Management**: Create and manage multiple workspaces
- 📄 **Document Upload**: Upload multiple files (PDF, TXT, MD, DOC, DOCX)
- 🌐 **URL Processing**: Add and process web URLs
- 💬 **AI Chat Interface**: Ask questions about your documents with RAG-powered responses
- 🎨 **Modern UI**: Built with Ant Design and Tailwind CSS
- 💾 **Local Storage**: Workspaces persist in browser localStorage
- ⚡ **Real-time Updates**: Live document processing status

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Ant Design** - UI components
- **Tailwind CSS** - Utility-first CSS
- **Axios** - HTTP client
- **React Router** - Navigation

## Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running on `http://localhost:8000`

## Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure environment (optional):
```bash
cp .env.example .env
# Edit .env if your API is on a different URL
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

The production build will be in the `dist` folder.

## Usage

### 1. Create a Workspace
- Click "Create Workspace" button
- Enter a name for your workspace
- Click "Create"

### 2. Upload Documents
- Open a workspace
- Go to "Documents & URLs" tab
- Click "Select Files" to choose documents
- Click "Upload" to process them

### 3. Add URLs
- Click "Add URLs" button
- Enter URLs (one per line)
- Click "Submit"

### 4. Chat with AI
- Go to "Chat Assistant" tab
- Type your question about the uploaded content
- Get AI-powered answers with sources

## Features in Detail

### Workspace Management
- Workspaces are stored in localStorage
- Each workspace has a unique ID
- Easy navigation between workspaces

### Document Processing
- Supports multiple file formats
- Bulk upload capability
- Real-time processing status
- View all uploaded documents
- Delete individual documents

### AI Chat
- Context-aware responses
- Source attribution
- Relevant chunk display
- Suggested follow-up questions
- Chat history (session-based, clears on refresh)

### UI/UX
- Responsive design
- Clean, modern interface
- Intuitive navigation
- Loading states and error handling
- Success/error notifications

## API Integration

The frontend integrates with these API endpoints:

- `POST /workspaces` - Create workspace
- `GET /workspaces` - List workspaces
- `POST /workspaces/{id}/upload/files` - Upload files
- `POST /workspaces/{id}/upload/urls` - Upload URLs
- `GET /workspaces/{id}/contents` - Get documents
- `DELETE /workspaces/{id}/documents/{name}` - Delete document
- `POST /workspaces/{id}/chat` - Chat with AI

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── DocumentsTab.tsx
│   │   └── ChatTab.tsx
│   ├── pages/
│   │   ├── WorkspaceList.tsx
│   │   └── WorkspaceDetail.tsx
│   ├── services/
│   │   └── api.ts
│   ├── utils/
│   │   └── storage.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Customization

### Branding
Edit `src/components/Header.tsx` to customize:
- Logo/icon
- App name
- Tagline

### Theme
Edit `src/main.tsx` ConfigProvider to customize Ant Design theme:
```typescript
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff', // Change primary color
      borderRadius: 8,
    },
  }}
>
```

### Tailwind
Edit `tailwind.config.js` to customize Tailwind theme.

## Troubleshooting

### API Connection Issues
- Ensure backend is running on `http://localhost:8000`
- Check CORS settings in backend
- Verify `.env` file has correct API URL

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `rm -rf dist .vite`

## License

MIT
