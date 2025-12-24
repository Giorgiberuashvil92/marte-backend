/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BOGPaymentService } from './bog-payment.service';
import { BOGOAuthService } from './bog-oauth.service';
import { PaymentsService } from '../payments/payments.service';
import {
  BOGOrderRequestDto,
  BOGOrderResponseDto,
  BOGPaymentStatusDto,
  BOGRecurringPaymentDto,
  BOGRecurringPaymentResponseDto,
} from './dto/bog-payment.dto';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('bog')
export class BOGController {
  private readonly logger = new Logger(BOGController.name);

  constructor(
    private readonly bogPaymentService: BOGPaymentService,
    private readonly bogOAuthService: BOGOAuthService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  /**
   * BOG-ში შეკვეთის შექმნა
   * POST /bog/create-order
   */
  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body() orderData: BOGOrderRequestDto,
  ): Promise<BOGOrderResponseDto> {
    try {
      this.logger.log('🔄 BOG შეკვეთის შექმნის მოთხოვნა მიღებულია');

      const result = await this.bogPaymentService.createOrder(orderData);

      this.logger.log('✅ BOG შეკვეთა წარმატებით შეიქმნა:', result.id);

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG შეკვეთის შექმნის შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * BOG შეკვეთის სტატუსის შემოწმება
   * GET /bog/order-status/:orderId
   */
  @Get('order-status/:orderId')
  async getOrderStatus(
    @Param('orderId') orderId: string,
  ): Promise<BOGPaymentStatusDto> {
    try {
      this.logger.log(`🔍 BOG შეკვეთის სტატუსის შემოწმება: ${orderId}`);

      const result = await this.bogPaymentService.getOrderStatus(orderId);

      this.logger.log('✅ BOG შეკვეთის სტატუსი მიღებულია:', result.status);

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG შეკვეთის სტატუსის შემოწმების შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * BOG OAuth token-ის სტატუსის შემოწმება (debug endpoint)
   * GET /bog/oauth-status
   */
  @Get('oauth-status')
  async getOAuthStatus(): Promise<{
    isTokenValid: boolean;
    expiresAt: number | null;
    message: string;
  }> {
    try {
      const isTokenValid = await this.bogOAuthService.isTokenValid();
      const expiresAt = this.bogOAuthService.getTokenExpiryTime();

      return {
        isTokenValid,
        expiresAt,
        message: isTokenValid
          ? 'Token ვალიდურია'
          : 'Token არ არის ვალიდური ან არ არსებობს',
      };
    } catch (error) {
      this.logger.error(
        '❌ BOG OAuth სტატუსის შემოწმების შეცდომა:',
        (error as Error).message,
      );

      return {
        isTokenValid: false,
        expiresAt: null,
        message: 'OAuth სტატუსის შემოწმება ვერ მოხერხდა',
      };
    }
  }

  /**
   * BOG გადახდის დეტალების მიღება
   * GET /bog/payment-details/:orderId
   * BOG API-დან გადახდის სრული დეტალების მიღება
   */
  @Get('payment-details/:orderId')
  async getPaymentDetails(@Param('orderId') orderId: string): Promise<any> {
    try {
      this.logger.log(`🔍 BOG გადახდის დეტალების მიღება: ${orderId}`);

      const result = await this.bogPaymentService.getPaymentDetails(orderId);

      this.logger.log('✅ BOG გადახდის დეტალები მიღებულია:', result.order_id);

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG გადახდის დეტალების მიღების შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * BOG Payment Callback Handler
   * POST /bog/callback
   * BOG-ისგან მიღებული callback-ების დამუშავება
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async handleBOGCallback(
    @Body() callbackData: any,
    @Headers() headers: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log('🔄 BOG CALLBACK მიღებულია - დეტალური ინფორმაცია:');
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log('📥 Headers:', JSON.stringify(headers, null, 2));
      this.logger.log(
        '📦 Callback Data:',
        JSON.stringify(callbackData, null, 2),
      );
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );

      // BOG callback-ის სტრუქტურის შემოწმება
      // BOG callback სტრუქტურა:
      // {
      //   event: 'order_payment',
      //   body: {
      //     client: { order_id: '...' },
      //     order_status: { key: 'completed', value: '...' },
      //     purchase_units: { request_amount: '1.0', currency_code: 'GEL' }
      //   }
      // }

      const innerBody =
        callbackData.body?.body || callbackData.body || callbackData;
      const order_id =
        (innerBody?.order_id as string) ||
        (callbackData.body?.client?.order_id as string) ||
        (callbackData.order_id as string) ||
        '';
      const status =
        (innerBody?.order_status?.key as string) ||
        (callbackData.body?.order_status?.key as string) ||
        (callbackData.status as string) ||
        '';
      const amount = innerBody?.purchase_units?.request_amount
        ? parseFloat(String(innerBody.purchase_units.request_amount))
        : callbackData.body?.purchase_units?.request_amount
          ? parseFloat(String(callbackData.body.purchase_units.request_amount))
          : callbackData.amount
            ? parseFloat(String(callbackData.amount))
            : 0;
      const currency =
        (innerBody?.purchase_units?.currency_code as string) ||
        (callbackData.body?.purchase_units?.currency_code as string) ||
        (callbackData.currency as string) ||
        'GEL';
      const external_order_id =
        (callbackData.external_order_id as string) ||
        (innerBody?.external_order_id as string) ||
        (callbackData.body?.external_order_id as string) ||
        '';

      this.logger.log('📊 გადახდის დეტალები:');
      this.logger.log(`   • Order ID: ${order_id}`);
      this.logger.log(`   • Status: ${status}`);
      this.logger.log(`   • Amount: ${amount}`);
      this.logger.log(`   • Currency: ${currency}`);
      this.logger.log(`   • External Order ID: ${external_order_id}`);

      if (!order_id) {
        this.logger.error('❌ BOG Callback-ში არ არის order_id');
        this.logger.error(
          '📦 Full callback data:',
          JSON.stringify(callbackData, null, 2),
        );
        return {
          success: false,
          message: 'Order ID არ არის მოწოდებული',
        };
      }

      // გადახდის სტატუსის დამუშავება
      if (status === 'completed' || status === 'success') {
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log(`✅ BOG გადახდა წარმატებულია: ${order_id}`);
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );

        try {
          this.logger.log('🔍 ვპოულობთ payment-ს database-ში...');
          // ვპოულობთ payment-ს ამ orderId-ით
          let payment: PaymentDocument | null = await this.paymentModel
            .findOne({ orderId: order_id })
            .exec();

          if (payment) {
            this.logger.log(`✅ Payment ნაპოვნია database-ში:`);
            this.logger.log(`   • Payment ID: ${payment._id}`);
            this.logger.log(`   • User ID: ${payment.userId}`);
            this.logger.log(
              `   • Amount: ${payment.amount} ${payment.currency}`,
            );
            this.logger.log(`   • Status: ${payment.status}`);
            this.logger.log(`   • Created: ${payment.createdAt?.toISOString() || 'N/A'}`);

            // განვაახლოთ payment BOG callback-ის დეტალური მონაცემებით
            const innerBodyForUpdate =
              callbackData.body?.body || callbackData.body || callbackData;
            const paymentDetailForUpdate =
              innerBodyForUpdate?.payment_detail ||
              callbackData.body?.payment_detail ||
              callbackData.payment_detail;
            const orderStatusForUpdate =
              innerBodyForUpdate?.order_status ||
              callbackData.body?.order_status ||
              callbackData.order_status;
            const purchaseUnitsForUpdate =
              innerBodyForUpdate?.purchase_units ||
              callbackData.body?.purchase_units ||
              callbackData.purchase_units;
            const redirectLinksForUpdate =
              innerBodyForUpdate?.redirect_links ||
              callbackData.body?.redirect_links ||
              callbackData.redirect_links;
            const buyerForUpdate =
              innerBodyForUpdate?.buyer ||
              callbackData.body?.buyer ||
              callbackData.buyer;

            const updateData: any = {
              status: 'completed',
              updatedAt: new Date(),
              externalOrderId: external_order_id,
              // BOG payment_detail-ის დეტალური მონაცემები
              transactionId: paymentDetailForUpdate?.transaction_id,
              payerIdentifier: paymentDetailForUpdate?.payer_identifier,
              transferAmount: paymentDetailForUpdate?.transfer_amount
                ? parseFloat(String(paymentDetailForUpdate.transfer_amount))
                : undefined,
              paymentOption: paymentDetailForUpdate?.payment_option,
              cardType: paymentDetailForUpdate?.card_type,
              cardExpiryDate: paymentDetailForUpdate?.card_expiry_date,
              refundAmount: paymentDetailForUpdate?.refund_amount
                ? parseFloat(String(paymentDetailForUpdate.refund_amount))
                : undefined,
              pgTrxId: paymentDetailForUpdate?.pg_trx_id,
              authCode: paymentDetailForUpdate?.auth_code,
              code: paymentDetailForUpdate?.code,
              codeDescription: paymentDetailForUpdate?.code_description,
              savedCardType: paymentDetailForUpdate?.saved_card_type,
              parentOrderId: paymentDetailForUpdate?.parent_order_id,
            };

            // metadata-ს განახლება
            const existingMetadata = payment.metadata || {};
            updateData.metadata = {
              ...existingMetadata,
              bogCallbackData: {
                payment_detail: paymentDetailForUpdate,
                order_status: orderStatusForUpdate,
                purchase_units: purchaseUnitsForUpdate,
                redirect_links: redirectLinksForUpdate,
                buyer: buyerForUpdate,
                event: callbackData.event,
                lang: callbackData.lang || innerBodyForUpdate?.lang,
                industry: callbackData.industry || innerBodyForUpdate?.industry,
                capture: callbackData.capture || innerBodyForUpdate?.capture,
                reject_reason:
                  callbackData.reject_reason || innerBodyForUpdate?.reject_reason,
                actions: callbackData.actions || innerBodyForUpdate?.actions,
                disputes: callbackData.disputes || innerBodyForUpdate?.disputes,
                split: callbackData.split || innerBodyForUpdate?.split,
                discount: callbackData.discount || innerBodyForUpdate?.discount,
              },
            };

            // განვაახლოთ payment-ი
            await this.paymentModel
              .findByIdAndUpdate(payment._id, updateData)
              .exec();
            this.logger.log(
              '✅ Payment განახლებულია BOG callback-ის მონაცემებით',
            );
          } else {
            this.logger.log(
              `⚠️ Payment არ მოიძებნა database-ში orderId-ით: ${order_id}`,
            );
          }

          // თუ payment არ არსებობს, შევქმნათ ახალი
          if (!payment) {
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );
            this.logger.log(`💾 ახალი Payment Record-ის შექმნა`);
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );
            this.logger.log(`   • Order ID: ${order_id}`);

            // BOG-ისგან მიღებული callback data-დან ვპოულობთ user-ს
            // external_order_id-დან (რომელიც შეიძლება შეიცავდეს user ID-ს)
            const externalOrderId =
              (callbackData.external_order_id as string) ||
              (callbackData.body?.external_order_id as string) ||
              '';
            this.logger.log(`   • External Order ID: ${externalOrderId}`);

            let userId = 'unknown';

            // Pattern: test_payment_1234567890_userId ან carapp_1234567890_userId
            const userIdMatch =
              externalOrderId.match(/test_payment_\d+_(.+)/) ||
              externalOrderId.match(/carapp_\d+_(.+)/);
            if (userIdMatch && userIdMatch[1]) {
              userId = userIdMatch[1];
              this.logger.log(`   ✅ User ID ნაპოვნია: ${userId}`);
            } else {
              this.logger.log(
                `   ⚠️ User ID ვერ მოიძებნა, გამოყენებული იქნება: ${userId}`,
              );
            }

            // BOG callback-ის დეტალური მონაცემების მოპოვება
            const innerBody =
              callbackData.body?.body || callbackData.body || callbackData;
            const paymentDetail = innerBody?.payment_detail || callbackData.body?.payment_detail || callbackData.payment_detail;
            const orderStatus = innerBody?.order_status || callbackData.body?.order_status || callbackData.order_status;
            const purchaseUnits = innerBody?.purchase_units || callbackData.body?.purchase_units || callbackData.purchase_units;
            const redirectLinks = innerBody?.redirect_links || callbackData.body?.redirect_links || callbackData.redirect_links;
            const buyer = innerBody?.buyer || callbackData.body?.buyer || callbackData.buyer;

            // შევქმნათ payment record BOG callback-ის ყველა მონაცემით
            const paymentData: any = {
              userId: userId,
              orderId: order_id,
              amount: amount || 0,
              currency: currency || 'GEL',
              paymentMethod: 'BOG',
              status: 'completed',
              context:
                (callbackData.product_id as string) ||
                (callbackData.body?.purchase_units?.items?.[0]
                  ?.external_item_id as string) ||
                'test',
              description:
                (callbackData.description as string) ||
                (callbackData.purchase_description as string) ||
                (callbackData.body?.purchase_units?.items?.[0]
                  ?.description as string) ||
                'BOG გადახდა',
              paymentDate: new Date().toISOString(),
              externalOrderId: external_order_id,
              // BOG payment_detail-ის დეტალური მონაცემები
              transactionId: paymentDetail?.transaction_id,
              payerIdentifier: paymentDetail?.payer_identifier,
              transferAmount: paymentDetail?.transfer_amount
                ? parseFloat(String(paymentDetail.transfer_amount))
                : undefined,
              paymentOption: paymentDetail?.payment_option,
              cardType: paymentDetail?.card_type,
              cardExpiryDate: paymentDetail?.card_expiry_date,
              refundAmount: paymentDetail?.refund_amount
                ? parseFloat(String(paymentDetail.refund_amount))
                : undefined,
              pgTrxId: paymentDetail?.pg_trx_id,
              authCode: paymentDetail?.auth_code,
              code: paymentDetail?.code,
              codeDescription: paymentDetail?.code_description,
              savedCardType: paymentDetail?.saved_card_type,
              parentOrderId: paymentDetail?.parent_order_id,
              metadata: {
                serviceName:
                  (callbackData.description as string) ||
                  (callbackData.purchase_description as string) ||
                  (callbackData.body?.purchase_units?.items?.[0]
                    ?.description as string) ||
                  'BOG გადახდა',
                // BOG callback-ის სრული მონაცემები
                bogCallbackData: {
                  payment_detail: paymentDetail,
                  order_status: orderStatus,
                  purchase_units: purchaseUnits,
                  redirect_links: redirectLinks,
                  buyer: buyer,
                  event: callbackData.event,
                  lang: callbackData.lang || innerBody?.lang,
                  industry: callbackData.industry || innerBody?.industry,
                  capture: callbackData.capture || innerBody?.capture,
                  reject_reason: callbackData.reject_reason || innerBody?.reject_reason,
                  actions: callbackData.actions || innerBody?.actions,
                  disputes: callbackData.disputes || innerBody?.disputes,
                  split: callbackData.split || innerBody?.split,
                  discount: callbackData.discount || innerBody?.discount,
                },
              },
            };

            this.logger.log('📝 Payment Data რომელიც შეინახება:');
            this.logger.log(JSON.stringify(paymentData, null, 2));

            this.logger.log('💾 Payment-ის შენახვა database-ში...');
            const newPayment =
              await this.paymentsService.createPayment(paymentData);

            payment = newPayment;
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );
            this.logger.log(`✅ ახალი Payment Record წარმატებით შეიქმნა!`);
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );
            this.logger.log(`   • Payment ID: ${String(newPayment._id)}`);
            this.logger.log(`   • User ID: ${newPayment.userId}`);
            this.logger.log(`   • Order ID: ${newPayment.orderId}`);
            this.logger.log(
              `   • Amount: ${newPayment.amount} ${newPayment.currency}`,
            );
            this.logger.log(`   • Status: ${newPayment.status}`);
            this.logger.log(`   • Context: ${newPayment.context}`);
            this.logger.log(`   • Description: ${newPayment.description}`);
            this.logger.log(`   • Created At: ${newPayment.createdAt?.toISOString() || 'N/A'}`);
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );

            // 🔍 Verification: შევამოწმოთ რომ payment რეალურად ინახება database-ში
            this.logger.log(
              '🔍 Verification: ვამოწმებთ payment-ის არსებობას database-ში...',
            );
            const verifyPayment = await this.paymentModel
              .findOne({ orderId: order_id })
              .exec();

            if (verifyPayment) {
              this.logger.log(
                `✅ VERIFICATION SUCCESS: Payment ნაპოვნია database-ში!`,
              );
              this.logger.log(
                `   • Verified Payment ID: ${String(verifyPayment._id)}`,
              );
              this.logger.log(
                `   • Verified Order ID: ${verifyPayment.orderId}`,
              );
            } else {
              this.logger.error(
                `❌ VERIFICATION FAILED: Payment არ მოიძებნა database-ში!`,
              );
              this.logger.error(`   • Order ID: ${order_id}`);
            }
          }

          // შევინახოთ order_id როგორც paymentToken recurring payment-ებისთვის
          if (payment) {
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );
            this.logger.log(
              '💾 Payment Token-ის შენახვა Recurring Payment-ებისთვის',
            );
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );
            this.logger.log(
              `   • Order ID (რომელიც გახდება token): ${order_id}`,
            );
            this.logger.log(`   • Payment ID: ${String(payment._id)}`);

            await this.paymentsService.savePaymentToken(order_id, order_id);

            this.logger.log(`✅ Payment Token წარმატებით შეინახა!`);
            this.logger.log(`   • Token: ${order_id}`);
            this.logger.log(
              `   • ეს token გამოყენებული იქნება recurring payment-ებისთვის`,
            );
            this.logger.log(
              '═══════════════════════════════════════════════════════',
            );

            // Subscription-ის შექმნა (თუ context არის 'subscription' ან 'test_subscription' ან 'test')
            const context = payment.context || '';
            if (
              context === 'subscription' ||
              context === 'test_subscription' ||
              context === 'test'
            ) {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log('📝 Subscription-ის შექმნა payment-ის შემდეგ');
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`   • User ID: ${payment.userId}`);
                this.logger.log(`   • Payment Token: ${order_id}`);
                this.logger.log(
                  `   • Amount: ${payment.amount} ${payment.currency}`,
                );
                this.logger.log(`   • Context: ${context}`);

                const subscription =
                  await this.subscriptionsService.createSubscriptionFromPayment(
                    payment.userId,
                    order_id,
                    payment.amount,
                    payment.currency,
                    context,
                  );

                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`✅ Subscription წარმატებით შეიქმნა!`);
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  `   • Subscription ID: ${String(subscription._id)}`,
                );
                this.logger.log(`   • User ID: ${subscription.userId}`);
                this.logger.log(`   • Plan: ${subscription.planName}`);
                this.logger.log(
                  `   • Price: ${subscription.planPrice} ${subscription.currency}`,
                );
                this.logger.log(`   • Period: ${subscription.period}`);
                this.logger.log(`   • Status: ${subscription.status}`);
                this.logger.log(
                  `   • Next Billing Date: ${subscription.nextBillingDate?.toISOString()}`,
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
              } catch (subscriptionError) {
                this.logger.error(
                  '❌ Subscription-ის შექმნის შეცდომა:',
                  subscriptionError instanceof Error
                    ? subscriptionError.message
                    : 'Unknown error',
                );
                // არ ვაბრუნებთ error-ს, რადგან payment-ი უკვე შენახულია
              }
            }
          } else {
            this.logger.warn(
              '⚠️ Payment არ არსებობს, token-ის შენახვა ვერ მოხერხდა',
            );
          }
        } catch (error) {
          this.logger.error(
            '═══════════════════════════════════════════════════════',
          );
          this.logger.error('❌ Payment-ის შენახვის შეცდომა!');
          this.logger.error(
            '═══════════════════════════════════════════════════════',
          );
          this.logger.error(`   • Order ID: ${order_id}`);
          this.logger.error(
            `   • Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          if (error instanceof Error && error.stack) {
            this.logger.error(`   • Stack: ${error.stack}`);
          }
          this.logger.error(
            '═══════════════════════════════════════════════════════',
          );
          // არ ვაბრუნებთ შეცდომას, რადგან callback-ი უნდა დასრულდეს წარმატებით
        }

        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log('✅ გადახდა წარმატებით დამუშავდა და დასრულდა!');
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );

        return {
          success: true,
          message: 'გადახდა წარმატებით დამუშავდა',
        };
      } else if (status === 'failed' || status === 'cancelled') {
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log(`❌ BOG გადახდა წარუმატებელია: ${order_id}`);
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log(`   • Order ID: ${order_id}`);
        this.logger.log(`   • Status: ${status}`);
        this.logger.log(`   • Amount: ${amount} ${currency}`);
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );

        return {
          success: false,
          message: 'გადახდა წარუმატებელია',
        };
      } else {
        this.logger.log(`⏳ BOG გადახდა pending-შია: ${order_id}`);

        return {
          success: true,
          message: 'გადახდა pending-შია',
        };
      }
    } catch (error) {
      this.logger.error(
        '❌ BOG Callback დამუშავების შეცდომა:',
        (error as Error).message,
      );

      return {
        success: false,
        message: 'Callback დამუშავება ვერ მოხერხდა',
      };
    }
  }

  /**
   * BOG OAuth token cache-ის გასუფთავება (debug endpoint)
   * POST /bog/clear-token-cache
   */
  @Post('clear-token-cache')
  @HttpCode(HttpStatus.OK)
  clearTokenCache(): { success: boolean; message: string } {
    try {
      this.bogOAuthService.clearTokenCache();

      return {
        success: true,
        message: 'Token cache წარმატებით გასუფთავებულია',
      };
    } catch (error) {
      this.logger.error(
        '❌ BOG OAuth token cache-ის გასუფთავების შეცდომა:',
        (error as Error).message,
      );

      return {
        success: false,
        message: 'Token cache-ის გასუფთავება ვერ მოხერხდა',
      };
    }
  }

  /**
   * რეკურინგ გადახდის განხორციელება
   * POST /bog/recurring-payment
   *
   * გამოიყენება წარმატებული გადახდის order_id, რომელიც ინახება პირველი გადახდის შემდეგ
   *
   * @see https://api.bog.ge/docs/ipay/recurring-payments
   */
  @Post('recurring-payment')
  @HttpCode(HttpStatus.OK)
  async processRecurringPayment(
    @Body() recurringPaymentData: BOGRecurringPaymentDto,
  ): Promise<BOGRecurringPaymentResponseDto> {
    try {
      this.logger.log('🔄 რეკურინგ გადახდის მოთხოვნა მიღებულია', {
        order_id: recurringPaymentData.order_id,
        amount: recurringPaymentData.amount,
      });

      const result =
        await this.bogPaymentService.processRecurringPayment(
          recurringPaymentData,
        );

      this.logger.log(
        '✅ რეკურინგ გადახდა წარმატებით განხორციელდა:',
        result.order_id,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ რეკურინგ გადახდის შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * Recurring payment token-ის მიღება (order_id) წარმატებული გადახდისგან
   * GET /bog/recurring-payment-token/:orderId
   *
   * ეს endpoint აბრუნებს order_id-ს, რომელიც გამოიყენება რეკურინგ გადახდებისთვის
   */
  @Get('recurring-payment-token/:orderId')
  async getRecurringPaymentToken(
    @Param('orderId') orderId: string,
  ): Promise<{ success: boolean; token?: string; message: string }> {
    try {
      this.logger.log(`🔍 Recurring payment token-ის მიღება: ${orderId}`);

      const token =
        await this.bogPaymentService.getRecurringPaymentToken(orderId);

      if (!token) {
        return {
          success: false,
          message:
            'Recurring payment token ვერ მოიძებნა. შეამოწმეთ რომ გადახდა წარმატებულია.',
        };
      }

      this.logger.log('✅ Recurring payment token მიღებულია');

      return {
        success: true,
        token,
        message: 'Recurring payment token წარმატებით მიღებულია',
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Recurring payment token-ის მიღების შეცდომა:',
        (error as Error).message,
      );

      return {
        success: false,
        message: `Recurring payment token-ის მიღება ვერ მოხერხდა: ${(error as Error).message}`,
      };
    }
  }
}
