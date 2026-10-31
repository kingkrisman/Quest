Contributing to NeuroLens

Thanks for helping make reading more comfortable and accessible. NeuroLens is a neurodivergent-friendly reading experience, so every contribution should support user choice, reduce cognitive load, and respect readers' privacy.

## Getting started

1. Install Node.js 22 or later.
2. Install project dependencies:

   ```bash
   npm install
   ```

3. Create a local `.env` file if you want to use AI-assisted reading features:

   ```env
   GEMINI_API_KEY=your_api_key
   ```

   The app remains usable without this key; AI actions will be unavailable.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` in your browser.

## Project layout

- `src/` — React application, UI components, types, and local reading utilities.
- `src/components/` — Main experience surfaces such as the landing page, reader, sidebar, and AI assistant.
- `src/lib/` — Shared utilities for document processing, text transformations, and site metadata.
- `public/` — Static assets and crawler-facing files.
- `server.ts` — Express server and the optional AI processing endpoint.
- `extension/` — Browser-extension source files.

## Development guidelines

### Accessibility and neurodivergent-friendly design

NeuroLens should be calm, understandable, and controllable. When changing the interface:

- Preserve readable defaults and let readers choose their own visual settings.
- Avoid forced motion, flashing effects, autoplay, and visually dense controls.
- Keep keyboard navigation, visible focus indicators, semantic HTML, and useful labels intact.
- Do not use colour as the only way to communicate meaning.
- Use clear, respectful language. Do not frame neurodivergence as a defect to be fixed.
- Test layouts at narrow and wide viewport sizes, including with increased browser zoom.

### Privacy and AI

- Treat uploaded and pasted text as sensitive user content.
- Do not add analytics, third-party requests, or data persistence without documenting the purpose and user impact.
- Keep AI assistance optional and clearly communicate when text is sent to an external service.
- Never commit API keys, `.env` files, tokens, or personal documents.

### Code style

- Use TypeScript and React function components.
- Follow existing component and utility patterns; keep changes focused.
- Prefer the existing Tailwind utility styles and shared helpers over adding duplicate CSS.
- Add accessible names to interactive controls and meaningful alternative text to images.

## Validate your changes

Before opening a pull request, run:

```bash
npm run lint
npm run build
```

Then test the affected flow in a browser. For reader changes, check text entry, PDF/TXT upload where relevant, profile controls, keyboard navigation, and the no-API-key state for AI features.

## Pull requests

Please keep pull requests small and explain:

- What changed and why.
- How you tested it.
- Any accessibility, privacy, or AI-service implications.
- Screenshots or a short recording for visible UI changes, where practical.

If your change alters reading behaviour or a default profile, describe who it is intended to help and any trade-offs considered. Avoid making universal claims about outcomes unless they are supported by evidence.

## Reporting issues

Use a clear title and include steps to reproduce, expected behaviour, actual behaviour, browser/device details, and screenshots where helpful. Please remove personal reading content, API keys, and other sensitive information before sharing.

Thank you for helping NeuroLens give more people a reading space that meets them where they are.
