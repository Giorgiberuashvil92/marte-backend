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
    const currentVersion = '1.0.24';

    // minVersion = ყველა ამ ვერსიაზე დაბალი დაააფდეითებს
    // მაგ: minVersion '1.0.24' → 1.0.23, 1.0.22... ხედავს Force Update მოდალს; 1.0.24+ არა
    const minVersion = '1.0.24';

    const forceUpdate = true;

    return {
      minVersion,
      currentVersion,
      forceUpdate,
    };
  }
}
