import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getMinSupportedVersion(): {
    minVersion: string;
    currentVersion: string;
    forceUpdate: boolean;
  } {
    // მინიმალური მხარდაჭერილი ვერსია - თუ მომხმარებელს აქვს ამ ვერსიაზე დაბალი, უნდა დაააფდეითოს
    const currentVersion = '1.0.12'; // მიმდინარე ვერსია (ყველაზე ახალი) - App Store-ში არსებული ვერსია

    // minVersion - ყველა ამ ვერსიაზე დაბალი ვერსია უნდა დაააფდეითოს
    // თუ minVersion = '1.0.12' → ყველა 1.0.12-ზე დაბალი (1.0.11, 1.0.10...) დაააფდეითებს
    // თუ minVersion = '1.0.11' → ყველა 1.0.11-ზე დაბალი (1.0.10, 1.0.9...) დაააფდეითებს
    // თუ minVersion = currentVersion → მხოლოდ currentVersion-ზე დაბალი დაააფდეითებს
    const minVersion = '1.0.12'; // ახლა: ყველა 1.0.12-ზე დაბალი დაააფდეითებს

    // forceUpdate flag - თუ true, მაშინ force update-ია აქტიური (modal არ იხურება)
    // თუ false, მაშინ modal გამოჩნდება მაგრამ შეიძლება დახურულ იქნას (არ არის force)
    // შეცვალე ეს true-ზე როცა ახალი ვერსია App Store-ში გამოვიდა და გინდა force update
    const forceUpdate = true; // true - force update აქტიურია, false - არ არის force (მაგრამ modal მაინც გამოჩნდება)

    return {
      minVersion,
      currentVersion,
      forceUpdate,
    };
  }
}
