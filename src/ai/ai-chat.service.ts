import { Injectable } from '@nestjs/common';

export type AIChatComplexity =
  | 'simple'
  | 'diagnostic'
  | 'parts'
  | 'image'
  | 'pricing'
  | 'valuation'
  | 'risky';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AIChatRequest {
  message: string;
  service?: string;
  userId?: string;
  imageUrl?: string;
  vehicle?: {
    make?: string;
    model?: string;
    year?: string | number;
    plateNumber?: string;
    mileage?: string | number;
  };
  history?: AIChatMessage[];
}

export interface AIChatResponse {
  answer: string;
  modelUsed: string;
  complexity: AIChatComplexity;
  fallback: boolean;
}

export interface AIPartsQueryParseRequest {
  text: string;
  vehicle?: AIChatRequest['vehicle'];
}

export interface AIPartsQueryParseResponse {
  make?: string;
  makeAliases?: string[];
  model?: string;
  year?: string;
  partName: string;
  partAliases?: string[];
  confidence: number;
  needsVehicle: boolean;
  needsPart: boolean;
  modelUsed: string;
  fallback: boolean;
}

export type AIChatStreamEvent =
  | {
      type: 'meta';
      modelUsed: string;
      complexity: AIChatComplexity;
      fallback: boolean;
    }
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      answer: string;
      modelUsed: string;
      complexity: AIChatComplexity;
      fallback: boolean;
    }
  | { type: 'error'; message: string };

@Injectable()
export class AIChatService {
  async parsePartsQuery(
    request: AIPartsQueryParseRequest,
  ): Promise<AIPartsQueryParseResponse> {
    const text = request.text.trim();
    const fallback = this.fallbackPartsQueryParse(text, request.vehicle);

    if (!process.env.OPENAI_API_KEY) {
      return fallback;
    }

    try {
      const model =
        process.env.OPENAI_MODEL_PARTS ||
        process.env.OPENAI_MODEL_CHEAP ||
        'gpt-5.6-luna';
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'system',
              content:
                'Extract an auto parts search query from Georgian/English user text. Return only JSON with keys: make, makeAliases, model, year, partName, partAliases, confidence, needsVehicle, needsPart. Normalize car makes to common Latin market names when clear, e.g. მერსედესი -> Mercedes, ბმვ -> BMW. makeAliases must be an array of common marketplace/search spellings for the same make in Georgian and Latin, based on the user text and your knowledge. partAliases must be an array of equivalent part search terms in Georgian, Latin transliteration, English, and common marketplace spellings, e.g. რადიატორი -> radiator/cooling radiator, aporni -> აპორნი/brake disc. Do not invent missing model/year. partName should be the actual part, not the whole sentence.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                text,
                selectedVehicle: request.vehicle || null,
              }),
            },
          ],
          reasoning: { effort: 'low' },
          text: { verbosity: 'low', format: { type: 'json_object' } },
          max_output_tokens: 1800,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI ${response.status}`);
      }

      const json = await response.json();
      if (json?.status !== 'completed')
        throw new Error('Incomplete parts extraction');
      const raw = this.extractOutputText(json);
      const parsed = this.parseJsonObject(raw);
      if (
        typeof parsed.partName !== 'string' ||
        typeof parsed.confidence !== 'number'
      ) {
        throw new Error('Invalid parts extraction');
      }
      const partName =
        typeof parsed.partName === 'string' && parsed.partName.trim()
          ? parsed.partName.trim()
          : fallback.partName;
      const make =
        typeof parsed.make === 'string' && parsed.make.trim()
          ? parsed.make.trim()
          : fallback.make;

      return {
        make,
        makeAliases: Array.isArray(parsed.makeAliases)
          ? parsed.makeAliases
              .filter((alias) => typeof alias === 'string' && alias.trim())
              .map((alias) => alias.trim())
              .slice(0, 8)
          : fallback.makeAliases,
        model:
          typeof parsed.model === 'string' && parsed.model.trim()
            ? parsed.model.trim()
            : fallback.model,
        year:
          typeof parsed.year === 'string' && parsed.year.trim()
            ? parsed.year.trim()
            : fallback.year,
        partName,
        partAliases: Array.isArray(parsed.partAliases)
          ? parsed.partAliases
              .filter((alias) => typeof alias === 'string' && alias.trim())
              .map((alias) => alias.trim())
              .slice(0, 8)
          : fallback.partAliases,
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : fallback.confidence,
        needsVehicle: !make,
        needsPart: !partName,
        modelUsed: model,
        fallback: false,
      };
    } catch (error) {
      console.error('[AI_PARTS_PARSE] OpenAI request failed:', error);
      return fallback;
    }
  }

  async reply(request: AIChatRequest): Promise<AIChatResponse> {
    const complexity = this.classify(request);
    const model = this.pickModel();

    if (!process.env.OPENAI_API_KEY) {
      return {
        answer: this.fallbackAnswer(request, complexity),
        modelUsed: 'fallback',
        complexity,
        fallback: true,
      };
    }

    try {
      const answer = await this.callOpenAI(request, model, complexity);
      return {
        answer: this.cleanAnswer(answer),
        modelUsed: model,
        complexity,
        fallback: false,
      };
    } catch (error) {
      console.error('[AI_CHAT] OpenAI request failed:', error);
      return {
        answer: this.fallbackAnswer(request, complexity),
        modelUsed: 'fallback',
        complexity,
        fallback: true,
      };
    }
  }

  async *streamReply(
    request: AIChatRequest,
  ): AsyncGenerator<AIChatStreamEvent> {
    const complexity = this.classify(request);
    const model = this.pickModel();

    if (!process.env.OPENAI_API_KEY) {
      const answer = this.fallbackAnswer(request, complexity);
      yield { type: 'meta', modelUsed: 'fallback', complexity, fallback: true };
      yield {
        type: 'done',
        answer,
        modelUsed: 'fallback',
        complexity,
        fallback: true,
      };
      return;
    }

    yield { type: 'meta', modelUsed: model, complexity, fallback: false };

    try {
      let answer = '';
      for await (const delta of this.callOpenAIStream(
        request,
        model,
        complexity,
      )) {
        const cleanedDelta = delta.replace(
          /როგორც AI ენის მოდელი[:,]?\s*/gi,
          '',
        );
        if (!cleanedDelta) continue;
        answer += cleanedDelta;
        yield { type: 'delta', text: cleanedDelta };
      }

      const clean = this.cleanAnswer(answer);
      if (!clean) throw new Error('OpenAI returned an empty answer');
      yield {
        type: 'done',
        answer: clean,
        modelUsed: model,
        complexity,
        fallback: false,
      };
    } catch (error) {
      console.error('[AI_CHAT_STREAM] OpenAI request failed:', error);
      const answer = this.fallbackAnswer(request, complexity);
      yield { type: 'delta', text: answer };
      yield {
        type: 'done',
        answer,
        modelUsed: 'fallback',
        complexity,
        fallback: true,
      };
    }
  }

  private classify(request: AIChatRequest): AIChatComplexity {
    const text =
      `${request.service || ''} ${request.message || ''}`.toLowerCase();

    if (
      /ავარია|ცეცხლი|კვამლი|გადახურ|გადახურდ|სასწრაფ|danger|unsafe|smoke|fire|overheat|ვერ ვაჩერებ|არ ჩერდება|brake.*(?:fail|not work)|(?:მუხრუჭ|ტორმუზ).*(?:არ მუშაობ|აღარ მუშაობ|გამეთიშ)/.test(
        text,
      )
    ) {
      return 'risky';
    }

    if (request.imageUrl) return 'image';

    if (
      /საშუალო ფასი|საბაზრო|გაყიდვ|შეფასება|რა ღირს ჩემი|market value|valuation|resale/.test(
        text,
      )
    ) {
      return 'valuation';
    }

    if (
      /ფოტო|სურათ|დაზიან|ამოიცან|შეხედ|photo|image|damage|detect/.test(text)
    ) {
      return 'image';
    }

    if (
      /ფასი|ღირს|დამიჯდება|შეფას|ბიუჯეტ|ლარი|gel|price|cost|estimate/.test(text)
    ) {
      return 'pricing';
    }

    if (
      /ნაწილ|ფარ|ბამპერ|სარკე|კარი|დისკ|ხუნდ|part|parts|bumper|headlight|brake pad/.test(
        text,
      )
    ) {
      return 'parts';
    }

    if (
      /ხმა|წრიპინ|კაკუნ|ანთია|check engine|ქოქ|ტორმუზ|მუხრუჭ|ძრავ|კოლოფ|diagnos|problem|noise|brake/.test(
        text,
      )
    ) {
      return 'diagnostic';
    }

    return 'simple';
  }

  private pickModel(): string {
    // Conversational Georgian is quality-sensitive even for short questions.
    // Extraction retains a separate, cheaper model in parsePartsQuery.
    return process.env.OPENAI_MODEL_CHAT || 'gpt-5.6-sol';
  }

  private reasoningEffort(complexity: AIChatComplexity): 'low' | 'medium' {
    return complexity === 'risky' || complexity === 'diagnostic'
      ? 'medium'
      : 'low';
  }

  private maxOutputTokens(complexity: AIChatComplexity): number {
    // Responses counts reasoning against this limit as well as visible text.
    return complexity === 'risky' || complexity === 'diagnostic' ? 5000 : 3200;
  }

  private fallbackPartsQueryParse(
    text: string,
    vehicle?: AIChatRequest['vehicle'],
  ): AIPartsQueryParseResponse {
    const wordsToRemove = [
      'მჭირდება',
      'მინდა',
      'მომიძებნე',
      'ნაწილი',
      'parts',
      'part',
      'for',
    ];
    const lower = text.toLowerCase();
    let make = vehicle?.make ? String(vehicle.make) : undefined;

    if (/მერსედეს|mercedes|benz/.test(lower)) make = 'Mercedes';
    else if (/ბმვ|ბეემვე|bmw/.test(lower)) make = 'BMW';
    else if (/ტოიოტა|toyota/.test(lower)) make = 'Toyota';
    else if (/ლექსუს|lexus/.test(lower)) make = 'Lexus';

    let partName = text;
    for (const token of wordsToRemove) {
      partName = partName.replace(new RegExp(token, 'gi'), ' ');
    }
    if (make) {
      partName = partName.replace(new RegExp(make, 'gi'), ' ');
      if (make === 'Mercedes') {
        partName = partName.replace(/მერსედეს(?:ის)?|mercedes|benz/gi, ' ');
      }
    }
    partName = partName.replace(/\s+/g, ' ').trim();

    return {
      make,
      makeAliases: make ? [make] : [],
      model: vehicle?.model ? String(vehicle.model) : undefined,
      year: vehicle?.year ? String(vehicle.year) : undefined,
      partName,
      partAliases: partName ? [partName] : [],
      confidence: partName ? 0.45 : 0.2,
      needsVehicle: !make,
      needsPart: !partName,
      modelUsed: 'local-rule',
      fallback: true,
    };
  }

  private parseJsonObject(raw: string): Record<string, any> {
    const trimmed = raw.trim();
    if (!trimmed) return {};

    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return {};
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return {};
      }
    }
  }

  private async callOpenAI(
    request: AIChatRequest,
    model: string,
    complexity: AIChatComplexity,
  ): Promise<string> {
    const input = this.buildInput(request, complexity);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        reasoning: { effort: this.reasoningEffort(complexity) },
        text: { verbosity: 'low' },
        max_output_tokens: this.maxOutputTokens(complexity),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI ${response.status}: ${body.slice(0, 300)}`);
    }

    const json = await response.json();
    const text = this.extractOutputText(json);
    if (json?.status !== 'completed' || !text) {
      throw new Error(
        `OpenAI response did not include output text (status=${json?.status || 'unknown'}, reason=${json?.incomplete_details?.reason || 'none'})`,
      );
    }
    return text.trim();
  }

  private async *callOpenAIStream(
    request: AIChatRequest,
    model: string,
    complexity: AIChatComplexity,
  ): AsyncGenerator<string> {
    const input = this.buildInput(request, complexity);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        stream: true,
        reasoning: { effort: this.reasoningEffort(complexity) },
        text: { verbosity: 'low' },
        max_output_tokens: this.maxOutputTokens(complexity),
      }),
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `OpenAI stream ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;

    const parseLine = (line: string): string | undefined => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      const event = JSON.parse(data);
      if (
        ['response.failed', 'response.incomplete', 'error'].includes(event.type)
      ) {
        throw new Error(`OpenAI stream did not complete: ${event.type}`);
      }
      if (event.type === 'response.completed') {
        completed = event.response?.status === 'completed';
      }
      if (
        event.type === 'response.output_text.delta' &&
        typeof event.delta === 'string'
      )
        return event.delta;
    };

    for await (const chunk of response.body as any) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const delta = parseLine(line.trim());
        if (delta) yield delta;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const delta = parseLine(buffer.trim());
      if (delta) yield delta;
    }
    if (!completed) throw new Error('OpenAI stream ended before completion');
  }

  private buildInput(request: AIChatRequest, complexity: AIChatComplexity) {
    const vehicle = request.vehicle;
    const vehicleLine = vehicle?.make
      ? `${vehicle.make} ${vehicle.model || ''} ${vehicle.year || ''}`.trim()
      : 'მანქანა არ არის არჩეული';
    const vehicleMileage = vehicle?.mileage
      ? `${vehicle.mileage} კმ`
      : 'უცნობია';

    const history = (request.history || [])
      .filter(
        (message) =>
          ['user', 'assistant'].includes(message.role) &&
          typeof message.text === 'string' &&
          message.text.trim(),
      )
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.text.slice(0, 8000),
      }));

    const system = [
      'შენ ხარ MARTE AI, ქართული ავტოაპის ასისტენტი. ამ ეტაპზე ეხმარები მომხმარებელს ავტონაწილის მოთხოვნის მომზადებასა და მანქანაზე კითხვების გარკვევაში.',
      'უპასუხე გამართული, ბუნებრივი ქართულით, მეგობრულად და კონკრეტულად. გამოიყენე დამკვიდრებული ავტოტერმინები; ნუ მოიგონებ სიტყვებს და ნუ აურევ ქართულს უცხოენოვან ფრაზებში. ბრენდები, VIN, OEM და OBD კოდები დატოვე უცვლელად.',
      'ჯერ უპასუხე უშუალოდ დასმულ კითხვას. მარტივ კითხვას 2–4 წინადადება ჰყოფნის; სია გამოიყენე მხოლოდ რამდენიმე მოქმედების ან ვარიანტის ასახსნელად. არ არის საჭირო ყველა პასუხის ოთხ ნაბიჯად გაწერა.',
      'გაითვალისწინე საუბრის ისტორია და უკვე მოცემული მანქანის მონაცემები. ავტოფარეხის ავტომატური კონტექსტი მხოლოდ საწყისი ვარაუდია: თუ მომხმარებელმა საუბრის ნებისმიერ წინა ან მიმდინარე შეტყობინებაში სხვა მანქანა დაასახელა, გამოიყენე ბოლოს მის მიერ დასახელებული მანქანა და აღარ დაუბრუნდე ავტოფარეხის მანქანას. მოკლე დაზუსტება (მაგალითად „მარცხენა“) აგრძელებს იმავე მოთხოვნას. განმეორებით ნუ მოითხოვ ცნობილ ინფორმაციას.',
      'თუ ნაწილი სჭირდება, დააზუსტე მხოლოდ აუცილებელი უცნობი დეტალი: მანქანა, ნაწილი, საჭიროებისას მხარე ან კომპლექტაცია. ერთ ჯერზე დასვი მხოლოდ ერთი კონკრეტული კითხვა. ზოგად კითხვაზე მანქანის დამატებას ნუ მოითხოვ, თუ პასუხისთვის საჭირო არ არის.',
      'მონაცემების შეგროვების შემდეგ მოკლედ ჩამოაყალიბე მოთხოვნის ტექსტი და მიუთითე ჩატში ღილაკი „ნაწილი გჭირდება?“, საიდანაც მომხმარებელი ამოწმებს და აგზავნის მოთხოვნას. შენ თვითონ ვერ აქვეყნებ მოთხოვნას, ვერ უკავშირდები მაღაზიას და ვერ ქმნი ჯავშანს.',
      'არ გაქვს წვდომა ცოცხალ ფასებზე, მარაგზე, განცხადებებზე ან მაღაზიების პასუხებზე. არ მოიგონო ფასები, დიაპაზონები, ნაწილის კოდები, შეთავაზებები ან ზუსტი თავსებადობა. ფასზე ილაპარაკე მხოლოდ მაშინ, როცა გკითხავენ; უთხარი, რომ რეალურ ფასს მაღაზიის შეთავაზება სჭირდება.',
      'მოდელის წელი მარტო თავსებადობის გარანტია არ არის. საჭიროებისას მიუთითე VIN-ით ან ნაწილის არსებული კოდით გადამოწმება. ზეთის ზუსტი სპეციფიკაცია, მოცულობა და სერვისის ინტერვალი არ გამოიცნო არასრული მონაცემებით.',
      'დიაგნოსტიკაში განასხვავე სავარაუდო მიზეზი და დადასტურებული ფაქტი. თუ რეალური სიმპტომი საშიშია (მუხრუჭი არ მუშაობს, კვამლი, გადახურება), დაიწყე უსაფრთხო გაჩერების რჩევით. მხოლოდ ნაწილის ყიდვა ან ზოგადი კითხვა ავარიულ მდგომარეობას არ ნიშნავს.',
      'თუ ფოტო არ არის მოცემული, ნუ იტყვი რომ ხედავ ფოტოს. ფოტოდანაც არ დაადასტურო უხილავი დაზიანება ან ზუსტი თავსებადობა.',
      'არ მისცე პასუხს გამოგონილი სიზუსტის პროცენტები, ფასის გარანტია ან ტექსტი თითქოს ბაზა გადაამოწმე. თუ რამე არ იცი, მოკლედ თქვი რა არის გადასამოწმებელი და როგორ.',
    ].join('\n');

    // Put automatic garage data before the conversation. Repeating it inside the
    // newest user turn made it overwrite a different car named earlier in chat.
    const garageContext = {
      role: 'user' as const,
      content: `აპლიკაციის ავტომატური საწყისი კონტექსტი (არ არის მომხმარებლის ახალი მითითება): ${JSON.stringify(
        {
          garageVehicle: vehicleLine,
          garageMileage: vehicleMileage,
          service: request.service || 'general',
        },
      )}`,
    };
    const userContent: any[] = [{ type: 'input_text', text: request.message }];
    if (request.imageUrl) {
      userContent.push({ type: 'input_image', image_url: request.imageUrl });
    }

    return [
      { role: 'system', content: system },
      garageContext,
      ...history,
      { role: 'user', content: userContent },
    ];
  }

  private extractOutputText(json: any): string {
    if (typeof json?.output_text === 'string') return json.output_text;

    const chunks: string[] = [];
    for (const item of json?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === 'string') chunks.push(content.text);
      }
    }
    return chunks.join('\n');
  }

  private cleanAnswer(answer: string): string {
    return answer
      .replace(/როგორც AI ენის მოდელი[:,]?\s*/gi, '')
      .replace(/as an ai language model[:,]?\s*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private fallbackAnswer(
    _request: AIChatRequest,
    _complexity: AIChatComplexity,
  ): string {
    return 'AI-სთან დაკავშირება ამ მომენტში ვერ მოხერხდა. გთხოვ, სცადე ხელახლა. ნაწილის მოთხოვნა შეგიძლია ცალკე ფორმით გაგზავნო.';
  }
}
