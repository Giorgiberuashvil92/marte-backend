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
    // მიმდინარე ვერსია (ყველაზე ახალი) - App Store-ში არსებული ვერსია
    // ეს უნდა ემთხვეოდეს app.json-ის version-ს
    const currentVersion = '1.0.14';

    // minVersion - ყველა ამ ვერსიაზე დაბალი ვერსია უნდა დაააფდეითოს
    // თუ minVersion = '1.0.10' → 1.0.10-ზე დაბალი დაააფდეითებს (1.0.9 და დაბალი, 1.0.10 და 1.0.11 არა)
    // თუ minVersion = '1.0.11' → 1.0.11-ზე დაბალი დაააფდეითებს (1.0.10 და დაბალი, 1.0.11 და 1.0.12 არა)
    // თუ minVersion = '1.0.12' → 1.0.12-ზე დაბალი დაააფდეითებს (1.0.11 და დაბალი, 1.0.12 არა)
    // თუ minVersion = '1.0.13' → 1.0.13-ზე დაბალი დაააფდეითებს (1.0.12 და დაბალი, 1.0.13 არა)
    // თუ minVersion = '1.0.14' → 1.0.14-ზე დაბალი დაააფდეითებს (1.0.13 და დაბალი, 1.0.14 არა)
    // ახლა: minVersion = '1.0.14', რათა 1.0.14-ზე ნაკლები ყველა ვერსია დაააფდეითოს
    const minVersion = '1.0.14'; // 1.0.14-ზე ნაკლები ყველა ვერსია დაააფდეითებს

    // forceUpdate flag - თუ true, მაშინ force update-ია აქტიური (modal არ იხურება)
    // თუ false, მაშინ modal გამოჩნდება მაგრამ შეიძლება დახურულ იქნას (არ არის force)
    // შეცვალე ეს true-ზე როცა ახალი ვერსია App Store-ში გამოვიდა და გინდა force update
    const forceUpdate = true; // false - modal შეიძლება დახურულ იქნას

    return {
      minVersion,
      currentVersion,
      forceUpdate,
    };
  }
}
