# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

## AI provider configuration

Chat reads private project secrets at request time; never commit credentials or use `VITE_` names:

1. `OPENAI_API_KEY`: official OpenAI Responses (`gpt-5.6`).
2. Otherwise `ANTHROPIC_API_KEY`: official Anthropic Messages (`claude-sonnet-4-6`).
3. If neither is set, the existing `LOVABLE_API_KEY` Gateway configuration remains unchanged (`openai/gpt-6-astra`).

Both keys configured means OpenAI wins. Official failures never trigger a Gateway fallback or spend Lovable AI credits. Direct usage is billed by the chosen provider; Oxford Bot's daily message quotas still apply. Image generation, transcription and speech remain on their existing Gateway endpoints and may still use Lovable AI credits. Claude's internal thinking is not displayed; Deep Think retains the public explanation card.

Store keys through Lovable's secure project secrets form (OpenAI: platform API keys; Anthropic: Console API keys). No keys are currently provisioned by this code. Official live verification requires the chosen key and model access; fixture tests verify routing/stream flags/header isolation, not account availability.

## Technology

- TanStack Start
- TypeScript
- React
- Tailwind CSS
