import { AIChatService, AIChatStreamEvent } from './ai-chat.service';

const encoder = new TextEncoder();
function stream(events: object[], chunkSize = 11) {
  const body = encoder.encode(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < body.length; i += chunkSize)
          controller.enqueue(body.slice(i, i + chunkSize));
        controller.close();
      },
    }),
    { status: 200 },
  );
}
async function collect(generator: AsyncGenerator<AIChatStreamEvent>) {
  const events: AIChatStreamEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

describe('AIChatService', () => {
  let service: AIChatService;
  let fetchMock: jest.SpyInstance;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-only-placeholder';
    process.env.OPENAI_MODEL_CHAT = 'gpt-5.6-sol';
    process.env.OPENAI_MODEL_CHEAP = 'gpt-5.6-luna';
    service = new AIChatService();
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('forwards a chat photo as image input rather than text', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output_text: 'ფოტოზე ჩანს ნაწილი' })));
    const photo = 'data:image/jpeg;base64,/9j/test-photo';
    await service.reply({ message: 'რა ნაწილია?', imageUrl: photo });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const currentMessage = payload.input[payload.input.length - 1];
    expect(currentMessage.content).toContainEqual({ type: 'input_image', image_url: photo });
  });

  it('uses the conversational model for a simple Georgian question, with properly separated history', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output_text: 'გამარჯობა, რით დაგეხმარო?',
        }),
      ),
    );
    const result = await service.reply({
      message: 'გამარჯობა',
      history: [
        { role: 'user', text: 'ჩემი მანქანა Toyota Prius 2015-ია' },
        { role: 'assistant', text: 'რა ნაწილი გჭირდება?' },
      ],
    });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.model).toBe('gpt-5.6-sol');
    expect(payload.reasoning.effort).toBe('low');
    expect(payload.input.map((item: { role: string }) => item.role)).toEqual([
      'system',
      'user',
      'user',
      'assistant',
      'user',
    ]);
    expect(payload.input[2].content).toBe('ჩემი მანქანა Toyota Prius 2015-ია');
    expect(result.fallback).toBe(false);
  });

  it('answers questions about part photos through the model instead of a canned upload instruction', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output_text: 'ფოტო ნაწილის ტიპის ამოცნობაში გვეხმარება.',
        }),
      ),
    );
    const result = await service.reply({
      message: 'ნაწილის ფოტო რაში მჭირდება?',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.modelUsed).toBe('gpt-5.6-sol');
    expect(result.answer).not.toContain('ჯერ ატვირთე');
  });

  it('keeps garage defaults before explicit car corrections and preserves a short follow-up', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output_text: 'BMW E90 2008-ის მარცხენა ფარი',
        }),
      ),
    );
    await service.reply({
      message: 'მარცხენა, ჰალოგენი',
      vehicle: { make: 'Toyota', model: 'Prius', year: 2015 },
      history: [
        { role: 'user', text: 'BMW E90 2008-ის წინა ფარი მჭირდება' },
        { role: 'assistant', text: 'რომელი მხარე?' },
      ],
    });
    const input = JSON.parse(fetchMock.mock.calls[0][1].body).input;
    expect(input[1].content).toContain('Toyota Prius 2015');
    expect(input[2].content).toBe('BMW E90 2008-ის წინა ფარი მჭირდება');
    expect(input.at(-1).content).toEqual([
      { type: 'input_text', text: 'მარცხენა, ჰალოგენი' },
    ]);
  });

  it.each([
    ['წინა მუხრუჭის ხუნდები მჭირდება', 'parts'],
    ['მუხრუჭი არ მუშაობს', 'risky'],
    ['ძრავი კაკუნობს', 'diagnostic'],
  ])(
    'classifies the request %s without treating every brake mention as an emergency',
    async (message, complexity) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'completed', output_text: 'პასუხი' }),
        ),
      );
      const result = await service.reply({ message });
      expect(result.complexity).toBe(complexity);
      const input = JSON.parse(fetchMock.mock.calls[0][1].body).input;
      expect(input.at(-1).content).toEqual([
        { type: 'input_text', text: message },
      ]);
    },
  );

  it('does not let the legacy cheap/smart configuration downgrade the new chat default', async () => {
    delete process.env.OPENAI_MODEL_CHAT;
    process.env.OPENAI_MODEL_SMART = 'gpt-5-mini';
    process.env.OPENAI_MODEL_CHEAP = 'gpt-5-nano';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'completed', output_text: 'გისმენ.' }),
      ),
    );
    await service.reply({ message: 'გამარჯობა' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(
      'gpt-5.6-sol',
    );
  });

  it('handles Georgian UTF-8 split across stream chunks and waits for completion', async () => {
    fetchMock.mockResolvedValue(
      stream([
        { type: 'response.output_text.delta', delta: 'რომელი ' },
        { type: 'response.output_text.delta', delta: 'ნაწილი გჭირდება?' },
        { type: 'response.completed', response: { status: 'completed' } },
      ]),
    );
    const events = await collect(
      service.streamReply({ message: 'ნაწილი მინდა' }),
    );
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      answer: 'რომელი ნაწილი გჭირდება?',
      modelUsed: 'gpt-5.6-sol',
      fallback: false,
    });
  });

  it.each(['response.incomplete', 'response.failed', 'missing-completion'])(
    'does not report %s as a successful reply',
    async (type) => {
      const events: object[] = [
        { type: 'response.output_text.delta', delta: 'დაუმთავრებელი პასუხი' },
      ];
      if (type !== 'missing-completion') events.push({ type });
      fetchMock.mockResolvedValue(stream(events));
      const result = await collect(
        service.streamReply({ message: 'ნაწილი მინდა' }),
      );
      expect(result.at(-1)).toMatchObject({
        type: 'done',
        fallback: true,
        modelUsed: 'fallback',
      });
      expect((result.at(-1) as { answer: string }).answer).not.toContain(
        'დაუმთავრებელი',
      );
    },
  );

  it('does not present a truncated non-streaming response as a complete answer', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'incomplete',
          output_text: 'ნახევარი პასუხი',
        }),
      ),
    );
    const result = await service.reply({ message: 'გამარჯობა' });
    expect(result.fallback).toBe(true);
    expect(result.answer).not.toContain('ნახევარი პასუხი');
  });

  it('keeps structured part extraction on its own model', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output_text: JSON.stringify({
            make: 'Toyota',
            partName: 'წინა ფარი',
            partAliases: ['headlight'],
            confidence: 0.9,
          }),
        }),
      ),
    );
    const result = await service.parsePartsQuery({ text: 'ტოიოტას წინა ფარი' });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.model).toBe('gpt-5.6-luna');
    expect(payload.text.format).toEqual({ type: 'json_object' });
    expect(result).toMatchObject({
      make: 'Toyota',
      partName: 'წინა ფარი',
      fallback: false,
    });
  });
});
