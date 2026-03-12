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
    // currentVersion = ყველაზე ახალი ვერსია (უნდა ემთხვეოდეს app.json → version)
    const currentVersion = '1.0.22';

    // minVersion = ყველა ამ ვერსიაზე დაბალი დაააფდეითებს
    // მაგ: minVersion '1.0.21' → 1.0.20, 1.0.19... ხედავს Force Update მოდალს; 1.0.21+ არა
    const minVersion = '1.0.21';

    const forceUpdate = true;

    return {
      minVersion,
      currentVersion,
      forceUpdate,
    };
  }
}
