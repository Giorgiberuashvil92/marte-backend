# MARTE AI configuration

The assistant currently supports vehicle questions and preparing parts requests. Publishing a request happens in the app's reviewed parts form; the chat itself does not publish, reserve inventory, or contact sellers.

## Models

- `OPENAI_MODEL_CHAT=gpt-5.6-sol`: all conversational replies, including short questions and follow-ups. This is also the source default. Legacy `OPENAI_MODEL_SMART` and `OPENAI_MODEL_CHEAP` no longer select a chat model.
- `OPENAI_MODEL_PARTS`: optional extraction model override. Otherwise extraction uses `OPENAI_MODEL_CHEAP`, defaulting to `gpt-5.6-luna`. Extraction returns JSON, not a user-facing conversational reply.
- `OPENAI_API_KEY`: existing server-side credential. Never put it in an `EXPO_PUBLIC_` variable.

The Responses API uses low reasoning for routine replies and medium for diagnostic/risk-related questions. Output limits include reasoning tokens, so the visible answer length is controlled by the prompt and low verbosity rather than a tiny total token allowance.

Model documentation: [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

## Behavior

Responses use natural Georgian and preserve up to 12 preceding messages as separate user/assistant turns. The assistant asks for missing vehicle/part details instead of guessing fitment, oil specifications, stock, prices, or part codes. It does not force every response into a four-step pricing template.

Automatic garage data is placed before conversation history and explicitly labeled as a default. The latest user message contains only the user's actual text, so a short follow-up retains the vehicle explicitly named in the conversation. Questions mentioning photos go through the model instead of receiving a canned upload instruction. Brake-pad shopping is classified as a parts request; reported brake failure receives the higher reasoning budget used for risk-related questions. Routing labels are not inserted into the user's message.

The provider has a 55-second timeout, below the app's 60-second timeout. Failed, incomplete, empty, or interrupted provider responses are not reported as successful answers. The chat displays a retry action without duplicating the user's question.

Apply `OPENAI_MODEL_CHAT` in the environment of each deployed backend and restart/redeploy that service when changing environment variables. Local changes do not update a hosted backend's environment.

## Validation

From the workspace root:

```sh
npm run build --prefix marte-backend
npm test --prefix marte-backend -- --runInBand --watchman=false ai-chat.service.spec.ts
./node_modules/.bin/jest components/ai/__tests__/ai-flows.test.jsx --runInBand --watchman=false --watchAll=false
```

Local live checks on 2026-09-13 confirmed `modelUsed: gpt-5.6-sol` and `fallback: false` for parts-selection advice, a multi-turn headlight request, a price/availability question through streaming, and an oil question with missing engine details. These are smoke checks, not a guarantee of factual correctness for every automotive question.

Final verification after the vehicle-context correction:

- Backend build passed; 13 backend regression tests and 8 frontend flow tests passed.
- Four live service checks passed with Sol and no fallback, taking 4.6–5.6 seconds each: whether a photo is required, a brake-pad request, a price question, and a streamed follow-up.
- The conflicting-vehicle case was reproduced before the fix: garage Toyota Prius 2015 incorrectly replaced BMW E90 2008 from history. After the fix, “მარცხენა, ჩვეულებრივი ჰალოგენი” correctly returned a request for the BMW E90 2008 left front halogen headlight.
- Full app TypeScript checking still reports existing errors outside the AI files; the changed AI files have no reported errors. Native visual verification remains outstanding.
- These changes and environment settings are local; the hosted backend requires its own deployment and environment configuration.
