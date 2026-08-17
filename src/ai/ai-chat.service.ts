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

export type AIChatStreamEvent =
  | { type: 'meta'; modelUsed: string; complexity: AIChatComplexity; fallback: boolean }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: string; modelUsed: string; complexity: AIChatComplexity; fallback: boolean }
  | { type: 'error'; message: string };

@Injectable()
export class AIChatService {
  async reply(request: AIChatRequest): Promise<AIChatResponse> {
    const complexity = this.classify(request);
    const model = this.pickModel(complexity);

    if (this.needsPhotoUpload(request, complexity)) {
      return {
        answer:
          'ფოტოს შესაფასებლად ჯერ ატვირთე სურათი. საუკეთესოა ნათელი ფოტო 2-3 მეტრიდან და ერთი ახლო კადრი დაზიანებულ ნაწილზე. ფოტოს მიღების შემდეგ გეტყვი რა ჩანს, რა შეიძლება დაჯდეს და რა უნდა გადაამოწმო სერვისში.',
        modelUsed: 'local-rule',
        complexity,
        fallback: false,
      };
    }

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

  async *streamReply(request: AIChatRequest): AsyncGenerator<AIChatStreamEvent> {
    const complexity = this.classify(request);
    const model = this.pickModel(complexity);

    if (this.needsPhotoUpload(request, complexity) || !process.env.OPENAI_API_KEY) {
      const answer = this.needsPhotoUpload(request, complexity)
        ? 'ფოტოს შესაფასებლად ჯერ ატვირთე სურათი. საუკეთესოა ნათელი ფოტო 2-3 მეტრიდან და ერთი ახლო კადრი დაზიანებულ ნაწილზე. ფოტოს მიღების შემდეგ გეტყვი რა ჩანს, რა რისკია და რა უნდა გადაამოწმო სერვისში.'
        : this.fallbackAnswer(request, complexity);
      const modelUsed = this.needsPhotoUpload(request, complexity) ? 'local-rule' : 'fallback';
      yield { type: 'meta', modelUsed, complexity, fallback: modelUsed === 'fallback' };
      yield { type: 'delta', text: answer };
      yield { type: 'done', answer, modelUsed, complexity, fallback: modelUsed === 'fallback' };
      return;
    }

    yield { type: 'meta', modelUsed: model, complexity, fallback: false };

    try {
      let answer = '';
      for await (const delta of this.callOpenAIStream(request, model, complexity)) {
        const cleanedDelta = delta.replace(/როგორც AI ენის მოდელი[:,]?\s*/gi, '');
        if (!cleanedDelta) continue;
        answer += cleanedDelta;
        yield { type: 'delta', text: cleanedDelta };
      }

      const clean = this.cleanAnswer(answer);
      yield { type: 'done', answer: clean, modelUsed: model, complexity, fallback: false };
    } catch (error) {
      console.error('[AI_CHAT_STREAM] OpenAI request failed:', error);
      const answer = this.fallbackAnswer(request, complexity);
      yield { type: 'delta', text: answer };
      yield { type: 'done', answer, modelUsed: 'fallback', complexity, fallback: true };
    }
  }

  private classify(request: AIChatRequest): AIChatComplexity {
    const text = `${request.service || ''} ${request.message || ''}`.toLowerCase();

    if (
      /უსაფრთხო|ავარია|ცეცხლი|სუნი|კვამლი|გადახურდ|სასწრაფ|danger|unsafe|smoke|fire|მუხრუჭ|ტორმუზ|brake/.test(
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
      /ფასი|ღირს|დამიჯდება|შეფას|ბიუჯეტ|ლარი|gel|price|cost|estimate/.test(
        text,
      )
    ) {
      return 'pricing';
    }

    if (
      /ნაწილ|ფარ|ბამპერ|სარკე|კარი|დისკ|ძრავ|კოლოფ|part|parts|bumper|headlight/.test(
        text,
      )
    ) {
      return 'parts';
    }

    if (
      /ხმა|წრიპინ|კაკუნ|ანთია|check engine|ქოქ|ტორმუზ|მუხრუჭ|diagnos|problem|noise|brake/.test(
        text,
      )
    ) {
      return 'diagnostic';
    }

    return 'simple';
  }

  private needsPhotoUpload(
    request: AIChatRequest,
    complexity: AIChatComplexity,
  ): boolean {
    if (complexity !== 'image' || request.imageUrl) return false;
    return /ფოტო|სურათ|შეხედ|ამოიცან|photo|image|detect/.test(
      `${request.service || ''} ${request.message}`.toLowerCase(),
    );
  }

  private pickModel(complexity: AIChatComplexity): string {
    const cheap = process.env.OPENAI_MODEL_CHEAP || 'gpt-5-nano';
    const smart =
      process.env.OPENAI_MODEL_SMART || process.env.OPENAI_MODEL || 'gpt-5-mini';

    return complexity === 'simple' || complexity === 'image' ? cheap : smart;
  }

  private reasoningEffort(complexity: AIChatComplexity): 'minimal' | 'low' {
    return complexity === 'simple' || complexity === 'image' ? 'minimal' : 'low';
  }

  private maxOutputTokens(complexity: AIChatComplexity): number {
    if (complexity === 'simple') return 520;
    if (complexity === 'image') return 760;
    return 980;
  }

  private async callOpenAI(
    request: AIChatRequest,
    model: string,
    complexity: AIChatComplexity,
  ): Promise<string> {
    const input = this.buildInput(request, complexity);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
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
    if (!text) {
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
      throw new Error(`OpenAI stream ${response.status}: ${body.slice(0, 300)}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of response.body as any) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        let event: any;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        const delta =
          event?.type === 'response.output_text.delta'
            ? event.delta
            : '';
        if (typeof delta === 'string' && delta) yield delta;
      }
    }
  }

  private buildInput(request: AIChatRequest, complexity: AIChatComplexity) {
    const vehicle = request.vehicle;
    const vehicleLine = vehicle?.make
      ? `${vehicle.make} ${vehicle.model || ''} ${vehicle.year || ''}`.trim()
      : 'მანქანა არ არის არჩეული';
    const vehicleMileage = vehicle?.mileage ? `${vehicle.mileage} კმ` : 'უცნობია';

    const history = (request.history || [])
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'მომხმარებელი' : 'MARTE AI'}: ${m.text}`)
      .join('\n');

    const system = [
      'შენ ხარ MARTE AI — ქართული ავტო აპის ტექნიკური ასისტენტი. შენი მიზანია მომხმარებელს მისცე პრაქტიკული, უსაფრთხო და მოქმედებაზე ორიენტირებული პასუხი.',
      'ენა: უპასუხე ქართულად, ბუნებრივი მოკლე ფრაზებით. ინგლისური გამოიყენე მხოლოდ აუცილებელი ავტო ტერმინებისთვის: Check Engine, ABS, OBD, VIN და მსგავსი.',
      'სიზუსტე: არ გამოიგონო დიაგნოზი, რეალური ფასი, ხელმისაწვდომობა, პარტნიორის პასუხი, სამართლებრივი/სადაზღვევო გარანტია ან კონკრეტული სერვისის დაპირება.',
      'თუ მონაცემი არ გაქვს, არ შეავსო ფანტაზიით. დაწერე “არ მაქვს საკმარისი მონაცემი” და დაასახელე რა აკლია.',
      'ფასებზე არასდროს დაწერო ერთი ზუსტი რიცხვი. გამოიყენე მხოლოდ ფართო დიაპაზონი და confidence: დაბალი/საშუალო/მაღალი.',
      'ტონი: იყავი მშვიდი, საქმიანი და მეგობრული. ნუ გადააჭარბებ შიშს, მაგრამ რისკიან სიმპტომებზე იყავი მკაფიო.',
      'ფორმატი: უპასუხე ზუსტად 3-4 მოკლე ნომრიანი ნაბიჯით. თითო ნაბიჯი დაიწყე ასე: "1) სათაური — ტექსტი". არ დაწერო გრძელი აბზაცი.',
      'კონტექსტი: გამოიყენე მანქანის make/model/year/mileage, ისტორია და ფოტო მხოლოდ მაშინ, როცა მოცემულია. თუ ფოტო არ არის, არასდროს თქვა რომ ხედავ ფოტოს.',
      'დასკვნები: დიაგნოსტიკაში არ თქვა “ზუსტად ეს არის”. გამოიყენე “შეიძლება იყოს”, “ხშირი მიზეზია”, “გადასამოწმებელია”.',
      'უსაფრთხოება: მუხრუჭი, საჭე, საბურავი, კვამლი, წვის სუნი, გადახურება, ძლიერი კაკუნი, ზეთის წნევა ან დატენვის პრობლემა — დაიწყე უსაფრთხო ქმედებით: გაჩერება, აღარ გააგრძელოს მოძრაობა, სერვისი/ევაკუატორი.',
      'ფასი: ნაწილები/სერვისი თქვი ლარში (₾), მაგრამ ავტომობილის საბაზრო შეფასება თქვი დოლარში ($). ყოველთვის მიუთითე რომ საბოლოო ფასი მდგომარეობაზე, კომპლექტაციაზე, განბაჟებაზე და ბაზარზეა დამოკიდებული.',
      'კითხვები: თუ მნიშვნელოვანი მონაცემი აკლია, დასვი მაქსიმუმ 1 კონკრეტული კითხვა და მაინც მიეცი უსაფრთხო შემდეგი ნაბიჯი.',
      'მოქმედება: ბოლო ნაბიჯი იყოს კონკრეტული next step: ფოტოს ატვირთვა, OBD კოდის მიწერა, მოთხოვნის ტექსტის მომზადება, ხელოსანთან/მაღაზიასთან გადამოწმება.',
      'აკრძალულია: ზედმეტი disclaimer, “როგორც AI”, ცხრილი, ძალიან დიდი ესე, არარეალური დარწმუნებულობა, სერვისის სახელების გამოგონება.',
      'აკრძალულია: “ზუსტად ღირს”, “გარანტირებულად”, “ბაზარზე ასეა” ან ისეთი ტექსტი, თითქოს live განცხადებები შეამოწმე.',
      this.complexityInstruction(complexity, !!request.imageUrl),
    ].join('\n');

    const userText = [
      `კონტექსტი: ${complexity}`,
      `სიზუსტის ჩარჩო: ${this.confidenceFrame(request, complexity)}`,
      `სერვისი: ${request.service || 'general'}`,
      `მანქანა: ${vehicleLine}`,
      `გარბენი: ${vehicleMileage}`,
      history ? `ბოლო ჩეთი:\n${history}` : '',
      `შეკითხვა: ${request.message}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const userContent: any[] = [{ type: 'input_text', text: userText }];
    if (request.imageUrl) {
      userContent.push({ type: 'input_image', image_url: request.imageUrl });
    }

    return [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ];
  }

  private complexityInstruction(
    complexity: AIChatComplexity,
    hasImage: boolean,
  ): string {
    if (complexity === 'image') {
      return hasImage
        ? 'ფოტოს პასუხი იყოს 4 ნაბიჯი: 1) რა ჩანს — მხოლოდ რაც ფოტოზე ჩანს, 2) რისკი — სავარაუდო და არა ზუსტი დიაგნოზი, 3) ფასი — თუ არ ჩანს დაზიანების მასშტაბი, ფასი არ თქვა ან თქვი ძალიან ფართო დიაპაზონი ₾-ში + დაბალი confidence, 4) შემდეგი ნაბიჯი — რა კუთხით/რა დეტალით გადაიღოს.'
        : 'ფოტოს გარეშე არ შეაფასო დაზიანება. სთხოვე ფოტოს ატვირთვა.';
    }

    if (complexity === 'pricing' || complexity === 'parts') {
      return 'ფასის/ნაწილის პასუხი იყოს 4 ნაბიჯი: 1) იდენტიფიკაცია — თუ ნაწილი ზუსტად არ არის ცნობილი, თქვი რომ აკლია, 2) ვარიანტები — ახალი/მეორადი/ანალოგი, 3) ფასი — მხოლოდ ფართო დიაპაზონი ₾-ში + confidence, 4) შემდეგი ნაბიჯი — რა მონაცემი/ფოტო/კოდი სჭირდება.';
    }

    if (complexity === 'valuation') {
      return 'ავტომობილის შეფასება იყოს 4 ნაბიჯი: 1) საშუალო ფასი — თუ make/model/year/mileage აკლია, ფასი არ თქვა; თუ არის, თქვი მხოლოდ ფართო დიაპაზონი დოლარში ($) + confidence, 2) ფასზე გავლენა — წელი/გარბენი/ძრავი/მდგომარეობა/განბაჟება/კომპლექტაცია, 3) სიზუსტისთვის — მაქსიმუმ 2 ყველაზე მნიშვნელოვანი აკლია, 4) გაყიდვამდე — რა გადაამოწმოს. აუცილებლად დაამატე რომ ეს არ არის live market quote.';
    }

    if (complexity === 'diagnostic') {
      return 'დიაგნოსტიკის პასუხი იყოს 4 ნაბიჯი: 1) უსაფრთხოება — შეიძლება თუ არა მოძრაობა, 2) სავარაუდო მიზეზები — 2-3 მიზეზი, 3) ახლავე შეამოწმე — ..., 4) სერვისში უთხარი — ....';
    }

    if (complexity === 'risky') {
      return 'რისკიან თემაზე პასუხი დაიწყე უსაფრთხოებით: თუ პრობლემა მუხრუჭს, კვამლს, გადახურებას ან წვის სუნს ეხება, ურჩიე მანქანის გაჩერება და პროფესიონალთან დაკავშირება.';
    }

    return 'მარტივ კითხვაზე უპასუხე 2-3 წინადადებით და ერთი შემდეგი მოქმედებით.';
  }

  private confidenceFrame(
    request: AIChatRequest,
    complexity: AIChatComplexity,
  ): string {
    if (complexity !== 'valuation') {
      return 'თუ ზუსტი მონაცემი არ არის, არ თქვა ზუსტი ფასი/დიაგნოზი; გამოიყენე სავარაუდო ენა.';
    }

    const text = `${request.message || ''}\n${request.vehicle?.make || ''} ${request.vehicle?.model || ''} ${request.vehicle?.year || ''} ${request.vehicle?.mileage || ''}`;
    const hasMakeModel =
      Boolean(request.vehicle?.make && request.vehicle?.model) ||
      /მარკა:\s*\S+[\s\S]*მოდელი:\s*\S+/i.test(text);
    const hasYear = Boolean(request.vehicle?.year) || /წელი:\s*\d{4}/i.test(text);
    const hasMileage = Boolean(request.vehicle?.mileage) || /გარბენი:\s*[\d\s,.]+/i.test(text);
    const hasCondition = /მდგომარეობა:\s*\S+/i.test(text);
    const hasEngine = /ძრავი|საწვავი|engine|hybrid|diesel|ბენზინი|დიზელი/i.test(text);

    const score = [hasMakeModel, hasYear, hasMileage, hasCondition, hasEngine].filter(Boolean).length;
    if (score < 3) {
      return 'დაბალი confidence: ფასი არ თქვა. სთხოვე მარკა, მოდელი, წელი და გარბენი.';
    }
    if (score < 5) {
      return 'დაბალი-საშუალო confidence: შეიძლება მხოლოდ ფართო $ დიაპაზონი, მინიმუმ 25-35% სიგანით. არ თქვა ერთი რიცხვი.';
    }
    return 'საშუალო confidence: შეიძლება $ დიაპაზონი, მაგრამ მაინც არა live market quote და არა გარანტირებული ფასი.';
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
    request: AIChatRequest,
    complexity: AIChatComplexity,
  ): string {
    const car = request.vehicle?.make
      ? `${request.vehicle.make} ${request.vehicle.model || ''} ${
          request.vehicle.year || ''
        }`.trim()
      : 'შენი მანქანისთვის';

    if (complexity === 'pricing' || complexity === 'parts') {
      return `1) სიზუსტე — ${car} ნაწილზე ზუსტ ფასს რეალური შეთავაზება სჭირდება.\n2) ფასი — ახლა მხოლოდ ფართო დიაპაზონის თქმა შეიძლება, confidence დაბალია.\n3) აკლია — მომწერე ნაწილის ზუსტი სახელი, ახალი/მეორადი გინდა და ქალაქი.\n4) შემდეგი ნაბიჯი — ამ მონაცემებით მოთხოვნის ტექსტს გაგიმზადებ მაღაზიებთან/დისმანტლერებთან.`;
    }

    if (complexity === 'valuation') {
      return `1) საშუალო ფასი — ზუსტი $ დიაპაზონისთვის საკმარისი მონაცემი არ მაქვს.\n2) აკლია — მომწერე მარკა, მოდელი, წელი, გარბენი, ძრავი/საწვავი და მდგომარეობა.\n3) სიზუსტე — შეფასება იქნება სავარაუდო, არა live market quote.\n4) შემდეგი ნაბიჯი — მონაცემებს რომ მომწერ, ფართო $ დიაპაზონს და ფასზე მოქმედ ფაქტორებს დაგიბრუნებ.`;
    }

    if (complexity === 'diagnostic' || complexity === 'risky') {
      return `1) უსაფრთხოება — ${car} პრობლემის ზუსტი დიაგნოზი დათვალიერებას მოითხოვს.\n2) რისკი — თუ არის კვამლი, გადახურება, მუხრუჭი ან ძლიერი კაკუნი, მოძრაობა არ გააგრძელო.\n3) აკლია — მომწერე როდის ჩნდება სიმპტომი და გარბენი.\n4) შემდეგი ნაბიჯი — ამით გეტყვი რა გადაამოწმო სერვისში.`;
    }

    return '1) გისმენ — მომწერე რა გჭირდება მანქანასთან დაკავშირებით.\n2) დეტალი — მარკა/მოდელი/წელი თუ დაამატებ, პასუხი ზუსტი იქნება.\n3) შემდეგი ნაბიჯი — შემიძლია დიაგნოსტიკა, ფასის შეფასება ან მოთხოვნის ტექსტი მოგიმზადო.';
  }
}
