# Chatbot Role Selection & Custom Base Prompt Feature

## Overview
This feature allows users to customize their chatbot's personality and behavior by selecting from predefined roles or creating custom prompts.

## Features Implemented

### 1. **Workspace Creation with Role Selection**
When creating a new workspace, users can now:
- Select from 4 chatbot roles:
  - **Customer Service** (default): Helpful, patient, problem-solving focused
  - **Sales Representative**: Persuasive, product-focused, conversion-oriented
  - **Technical Support**: Technical, detailed, troubleshooting focused
  - **Custom**: User-defined personality with custom prompt

### 2. **Role-Specific System Prompts**
Each role has a specialized system prompt that defines:
- Personality traits
- Communication style
- Response approach
- Key tactics and methods

Located in: `src/lib/rolePrompts.js`

### 3. **Custom Prompt Support**
Users can:
- Write their own system prompts
- Define unique chatbot personalities
- Customize behavior for specific use cases
- Warning shown about prompt quality impact

### 4. **Settings Modal in Chat**
After workspace creation, users can:
- Click "Settings" button in chat header
- Change chatbot role anytime
- Edit custom prompts
- See current role displayed as a tag

### 5. **Database Schema Updates**
Workspaces now store:
- `chatbot_role`: The selected role (customer_service, sales, technical_support, custom)
- `custom_prompt`: User's custom prompt (null if using default role)

## Technical Implementation

### Backend Changes

**1. Database (`src/lib/database.js`)**
- Updated `createWorkspace()` to accept `role` and `customPrompt` parameters
- Added `updateWorkspaceRole()` function to update role after creation
- Schema includes `chatbot_role` and `custom_prompt` fields

**2. Role Prompts (`src/lib/rolePrompts.js`)**
- `ROLE_PROMPTS` object with prompts for each role
- `getRolePrompt()` function to retrieve appropriate prompt
- `getRoleDisplayName()` for UI display
- `getDefaultPromptForRole()` for showing defaults

**3. RAG System (`src/lib/rag.js`)**
- Loads workspace role and custom prompt
- Combines role-specific prompt with core instructions
- Maintains all existing RAG functionality

**4. Server (`src/server.js`)**
- Updated `/workspaces` POST endpoint to accept role parameters
- Added `/workspaces/:id/role` PUT endpoint for updating role
- Validates role values

### Frontend Changes

**1. API Service (`frontend/src/services/api.ts`)**
- Updated `Workspace` interface with `chatbot_role` and `custom_prompt`
- Updated `createWorkspace()` to send role parameters
- Added `updateWorkspaceRole()` function

**2. Workspace Creation (`frontend/src/pages/WorkspaceList.tsx`)**
- Added role selection UI with 4 cards
- Custom prompt textarea for "Custom" role
- Validation for custom prompt requirement
- Visual indicators for selected role

**3. Chat Interface (`frontend/src/components/ChatTab.tsx`)**
- Added Settings button in header
- Shows current role as tag
- Settings modal with role selection
- Loads workspace settings on mount
- Updates role via API

## User Flow

### Creating a Workspace
1. Click "Create Workspace"
2. Enter workspace name
3. Select AI provider (Gemini/OpenAI)
4. **NEW:** Select chatbot role
5. **NEW:** If "Custom" selected, enter custom prompt
6. Optional: Add API key
7. Create workspace

### Changing Role After Creation
1. Open workspace chat
2. Click "Settings" button in header
3. Select new role
4. If "Custom", edit prompt
5. Click "Save"
6. New role applies to future messages

## Role Descriptions

### Customer Service
- **Personality**: Empathetic, patient, supportive
- **Best For**: Support tickets, troubleshooting, customer care
- **Approach**: Acknowledge concerns, provide step-by-step solutions, follow up

### Sales Representative
- **Personality**: Enthusiastic, consultative, value-focused
- **Best For**: Product information, pricing, purchase guidance
- **Approach**: Understand needs, highlight benefits, create urgency, guide to action

### Technical Support
- **Personality**: Methodical, precise, detail-oriented
- **Best For**: Technical documentation, APIs, developer support
- **Approach**: Gather diagnostics, systematic troubleshooting, explain root causes

### Custom
- **Personality**: User-defined
- **Best For**: Specialized use cases, unique requirements
- **Approach**: Defined by user's custom prompt

## Benefits

1. **Flexibility**: Different workspaces can have different personalities
2. **Optimization**: Role-specific prompts improve response quality
3. **Customization**: Advanced users can create specialized chatbots
4. **Easy Switching**: Change roles anytime without recreating workspace
5. **Clear Indication**: Users always know which role is active

## Future Enhancements

Potential improvements:
- Role templates library
- Prompt testing/preview
- Role analytics (which performs best)
- Import/export custom prompts
- Community-shared prompts
- A/B testing between roles

## Files Modified

### Backend
- `src/lib/database.js` - Schema and CRUD operations
- `src/lib/rolePrompts.js` - NEW: Role prompt definitions
- `src/lib/rag.js` - Integration with role prompts
- `src/server.js` - API endpoints

### Frontend
- `frontend/src/services/api.ts` - API client
- `frontend/src/pages/WorkspaceList.tsx` - Workspace creation UI
- `frontend/src/components/ChatTab.tsx` - Settings modal

## Testing Checklist

- [ ] Create workspace with each role
- [ ] Create workspace with custom prompt
- [ ] Verify role is saved to database
- [ ] Change role via settings modal
- [ ] Verify custom prompt is used
- [ ] Test validation (empty custom prompt)
- [ ] Verify role tag displays correctly
- [ ] Test with both Gemini and OpenAI
- [ ] Verify responses match role personality
- [ ] Test role switching mid-conversation

## Notes

- Role cannot be changed during workspace creation (must create new workspace)
- Custom prompts should be carefully designed for best results
- Role changes apply immediately to new messages
- Previous messages retain their original role's personality
- Default role is "Customer Service" if not specified
