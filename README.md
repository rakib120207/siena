# Siena

A Groq-powered chat assistant with a ChatGPT-style interface and floating, draggable Q/A cards inside each conversation.

## Features

**Chat**
- Streaming responses from Groq (OpenAI-compatible API), with a Stop button
- Markdown rendering: headings, lists, tables, quotes, links, inline code, and code blocks with syntax highlighting and a copy button
- "Thought for Ns" label for reasoning models (the reasoning text itself is never shown)
- Copy, edit, regenerate, good/bad response, and "Continue generating" for cut-off answers
- Regenerated answers are kept as versions you can flip through (`1/3`)
- Edit any of your earlier messages to branch the conversation from that point
- Scroll-to-bottom button and smart auto-scroll that never fights you while you read
- You can switch chats while an answer is still generating; it keeps going in the background

**Sidebar**
- Chats grouped by Pinned, Today, Yesterday, Previous 7 Days, Previous 30 Days, then by month
- Rename, pin, archive and delete from the chat menu (also on right-click)
- Search chats (title and message text) with `Ctrl/Cmd+K`
- Collapsible on desktop, slide-in drawer on mobile

**Also**
- Temporary chat that is never saved
- Model picker (GPT-OSS 120B / 20B) and thinking effort (low / medium / high)
- Custom instructions ("what Siena should know about you" and "how to respond")
- Light, dark and system themes
- Export a chat as Markdown or all chats as JSON; archive all; delete all
- ChatGPT-style keyboard shortcuts (see below)

**Floating cards (the unique part)**
- Press **Float** under any finished answer to pin that question and answer as a small card
- Cards are draggable by their title bar, stay inside the chat area, and remember their position
- A card is only a reference to one Q/A in the current conversation, never a separate chat
- Closing a card does not delete the message; cards never appear in other conversations
- Expand a card (button or double-click the title bar) to read the full Q/A and copy either part

## Requirements

- Node.js 18 or newer
- A Groq API key (https://console.groq.com/keys)

## Local setup

1. Unzip the project.
2. `cd siena`
3. `npm install`
4. Copy `.env.example` to `.env`, or edit the existing `.env`.
5. Add your `GROQ_API_KEY` to `.env`.
6. `npm run dev`

Open http://localhost:3000.

## Environment variables

| Name           | Required | Default               | Notes                                          |
| -------------- | -------- | --------------------- | ---------------------------------------------- |
| `GROQ_API_KEY` | Yes      | none                  | Used only on the server in `app/api/chat/route.ts` |
| `GROQ_MODEL`   | No       | `openai/gpt-oss-120b` | Model used when the picker is set to "Default" |

The model picker also offers `openai/gpt-oss-20b`. The server only accepts models from this allow-list plus your `GROQ_MODEL`, so a visitor cannot make your key call an arbitrary model.

## Vercel deployment

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. The framework preset should be Next.js.
4. Add the `GROQ_API_KEY` environment variable.
5. Optionally add `GROQ_MODEL`.
6. Deploy.

## Keyboard shortcuts

Use `Cmd` instead of `Ctrl` on macOS.

| Shortcut                   | Action                |
| -------------------------- | --------------------- |
| `Ctrl+Shift+O`             | New chat              |
| `Ctrl+K`                   | Search chats          |
| `Shift+Esc`                | Focus message box     |
| `Ctrl+Shift+C`             | Copy last response    |
| `Ctrl+Shift+;`             | Copy last code block  |
| `Ctrl+Shift+S`             | Toggle sidebar        |
| `Ctrl+Shift+Backspace`     | Delete chat           |
| `Ctrl+Shift+I`             | Custom instructions   |
| `Ctrl+/`                   | Show shortcuts        |
| `Enter` / `Shift+Enter`    | Send / new line       |

Some browsers reserve a few of these combinations. If one does nothing, use the menus instead.

## Troubleshooting

- **Missing GROQ_API_KEY**: the chat shows "Missing GROQ_API_KEY." Add the key to `.env` and restart `npm run dev`, or add it in Vercel project settings and redeploy.
- **Groq rejected the API key**: the key is wrong, revoked, or has extra spaces.
- **Model errors**: "The selected model may not exist" means the model id is not available to your account. Check `GROQ_MODEL`, or pick another model in the picker.
- **Rate limits**: "Groq rate limit reached" means you hit your quota. Wait and press Retry, or switch to the 20B model.
- **Long or empty answers**: reasoning models spend tokens on thinking. If an answer is cut off, use **Continue generating**. If you get "ran out of tokens", lower the thinking effort.
- **Build errors**: use Node.js 18+, delete `node_modules` and `.next`, then run `npm install` and `npm run build` again.
- **localStorage limits**: chats are stored in this browser only. A full or blocked storage shows a warning banner. Export or delete old chats to free space. Private windows and cleared site data lose chats.
- **Streaming looks stuck**: reasoning models can pause before the first word ("Thinking…"). If it never starts, check your network and any proxy or extension that buffers server-sent events.

## Important warning

This MVP has no authentication or rate limiting. Do not deploy it publicly without adding protection, or visitors could consume your Groq quota through the public API route.

## Limitations

- Conversations are stored only in the browser
- No accounts, server-side chat storage or multi-device sync
- Floating cards are stored per browser
- Editing a message removes the messages after it (there is no branch switcher for edits)
- No file or image uploads, voice, web search or math (LaTeX) rendering
- Chat titles are taken from your first message, not generated by the model
