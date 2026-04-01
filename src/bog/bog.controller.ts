/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
  HttpException,
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
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import { Dismantler, DismantlerDocument } from '../schemas/dismantler.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CarFAXService } from '../carfax/carfax.service';
import { StoresService } from '../stores/stores.service';
import { FinesService } from '../fines/fines.service';

@Controller('bog')
export class BOGController {
  private readonly logger = new Logger(BOGController.name);

  constructor(
    private readonly bogPaymentService: BOGPaymentService,
    private readonly bogOAuthService: BOGOAuthService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly carfaxService: CarFAXService,
    private readonly storesService: StoresService,
    private readonly finesService: FinesService,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Dismantler.name)
    private dismantlerModel: Model<DismantlerDocument>,
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
        (callbackData.order_status?.key as string) ||
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
      // შევამოწმოთ rejected status-იც, რადგან BOG-მ შეიძლება გაგვიგზავნოს rejected status-ი
      if (status === 'rejected') {
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log(`❌ BOG გადახდა უარყოფილია (rejected): ${order_id}`);
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log(`   • Order ID: ${order_id}`);
        this.logger.log(`   • Status: ${status}`);
        this.logger.log(`   • Amount: ${amount} ${currency}`);

        // ვპოულობთ payment-ს და განვაახლებთ status-ს rejected-ად
        const rejectedPayment = await this.paymentModel
          .findOne({ orderId: order_id })
          .exec();

        if (rejectedPayment) {
          const innerBodyForRejected =
            callbackData.body?.body || callbackData.body || callbackData;
          const rejectReason =
            innerBodyForRejected?.reject_reason ||
            callbackData.reject_reason ||
            innerBodyForRejected?.payment_detail?.code_description ||
            'Payment rejected';

          await this.paymentModel.findByIdAndUpdate(rejectedPayment._id, {
            status: 'rejected',
            updatedAt: new Date(),
            code: innerBodyForRejected?.payment_detail?.code,
            codeDescription: rejectReason,
            metadata: {
              ...(rejectedPayment.metadata || {}),
              bogCallbackData: {
                ...(rejectedPayment.metadata?.bogCallbackData || {}),
                order_status:
                  innerBodyForRejected?.order_status ||
                  callbackData.body?.order_status,
                reject_reason: rejectReason,
              },
            },
          });

          this.logger.log(`✅ Payment status განახლებულია rejected-ად`);
          this.logger.log(`   • Reject Reason: ${rejectReason}`);

          // თუ ეს არის recurring payment-ი, subscription-ის nextBillingDate არ განახლდება
          // რომ კვლავ ჩამოსაჭრელი იყოს
          if (
            rejectedPayment.isRecurring &&
            rejectedPayment.recurringPaymentId
          ) {
            this.logger.log(
              `   ⚠️ Recurring payment-ი rejected იყო, subscription-ის nextBillingDate არ განახლდა`,
            );
            this.logger.log(
              `   • Subscription ID: ${rejectedPayment.recurringPaymentId}`,
            );
            this.logger.log(
              `   • Subscription-ის nextBillingDate დარჩა იგივე, რომ კვლავ ჩამოსაჭრელი იყოს`,
            );
          }
        }

        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );

        // Rejected payment-ის შემთხვევაში ვაბრუნებთ 400 status code-ს
        throw new HttpException(
          {
            success: false,
            message: 'გადახდა უარყოფილია (rejected)',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (status === 'completed' || status === 'success') {
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.log(`✅ BOG გადახდა წარმატებულია: ${order_id}`);
        this.logger.log(
          '═══════════════════════════════════════════════════════',
        );

        try {
          // Context-ის განსაზღვრა (subscription-ის შემთხვევაში external_order_id-დან)
          // ეს უნდა იყოს განსაზღვრული payment-ის შემოწმებამდე, რომ იყოს ხელმისაწვდომი ორივე block-ში
          let context =
            (callbackData.product_id as string) ||
            (callbackData.body?.purchase_units?.items?.[0]
              ?.external_item_id as string) ||
            '';

          // თუ context არ არის, შევამოწმოთ external_order_id-ში
          if (!context && external_order_id) {
            if (
              external_order_id.includes('subscription') ||
              external_order_id.includes('test_subscription')
            ) {
              context = 'subscription';
            } else if (
              external_order_id.includes('carfax_package') ||
              external_order_id.includes('carfax-package')
            ) {
              context = 'carfax-package';
            } else if (external_order_id.includes('store_payment')) {
              context = 'store-payment';
            } else if (external_order_id.includes('test_payment')) {
              context = 'test';
            }
          }

          // Default context
          if (!context) {
            context = 'test';
          }

          this.logger.log('🔍 ვპოულობთ payment-ს database-ში...');
          // ვპოულობთ payment-ს ამ orderId-ით (BOG order_id)
          let payment: PaymentDocument | null = await this.paymentModel
            .findOne({ orderId: order_id })
            .exec();

          // თუ payment არ მოიძებნა, შევამოწმოთ external_order_id-ით.
          // აპი POST /api/payments-ზე ხშირად ინახავს მხოლოდ orderId = იგივე string რაც BOG-ზე გაეგზავნა external_order_id-ად,
          // externalOrderId ველს კი არ ავსებს — ამიტომ ორივე ველით ვეძებთ.
          if (!payment && external_order_id) {
            this.logger.log(
              `   🔍 Payment არ მოიძებნა BOG orderId-ით, ვცდილობთ external_order_id-ით (externalOrderId ან orderId ველი): ${external_order_id}`,
            );
            payment = await this.paymentModel
              .findOne({
                $or: [
                  { externalOrderId: external_order_id },
                  { orderId: external_order_id },
                ],
              })
              .exec();

            if (payment) {
              this.logger.log(
                `   ✅ Payment ნაპოვნია app-ის external order string-ით!`,
              );
              await this.paymentModel
                .findByIdAndUpdate(payment._id, {
                  orderId: order_id,
                  externalOrderId: external_order_id,
                })
                .exec();
              this.logger.log(
                `   ✅ Payment orderId → BOG id განახლებულია: ${order_id}`,
              );
            }
          }

          if (payment) {
            this.logger.log(`✅ Payment ნაპოვნია database-ში:`);
            this.logger.log(`   • Payment ID: ${String(payment._id)}`);
            this.logger.log(`   • User ID: ${payment.userId}`);
            this.logger.log(
              `   • Amount: ${payment.amount} ${payment.currency}`,
            );
            this.logger.log(`   • Status: ${payment.status}`);
            this.logger.log(
              `   • Created: ${payment.createdAt?.toISOString() || 'N/A'}`,
            );

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

            // Status-ის განსაზღვრა callback-ის status-ის მიხედვით
            // ამ block-ში status არის 'completed' ან 'success', ასე რომ paymentStatus იქნება 'completed'
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
                  callbackData.reject_reason ||
                  innerBodyForUpdate?.reject_reason,
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

            // თუ ეს არის recurring payment-ი და წარმატებულია, განვაახლოთ subscription-ის nextBillingDate
            if (payment.isRecurring && payment.recurringPaymentId) {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  '🔄 Recurring payment-ისთვის subscription-ის განახლება',
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  `   • Recurring Payment ID: ${payment.recurringPaymentId}`,
                );
                this.logger.log(`   • Payment Status: completed`);

                const subscription = await this.subscriptionModel
                  .findById(payment.recurringPaymentId)
                  .exec();

                if (subscription) {
                  // გამოვთვალოთ შემდეგი billing date
                  const nextBillingDate = new Date();
                  switch (subscription.period) {
                    case 'monthly':
                      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                      break;
                    case 'yearly':
                      nextBillingDate.setFullYear(
                        nextBillingDate.getFullYear() + 1,
                      );
                      break;
                    case 'weekly':
                      nextBillingDate.setDate(nextBillingDate.getDate() + 7);
                      break;
                    case 'daily':
                      nextBillingDate.setDate(nextBillingDate.getDate() + 1);
                      break;
                    default:
                      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                  }

                  await this.subscriptionModel.findByIdAndUpdate(
                    payment.recurringPaymentId,
                    {
                      nextBillingDate,
                      billingCycles: subscription.billingCycles + 1,
                      totalPaid:
                        subscription.totalPaid + subscription.planPrice,
                      orderId: order_id,
                      transactionId: order_id,
                      updatedAt: new Date(),
                    },
                  );

                  this.logger.log(
                    '═══════════════════════════════════════════════════════',
                  );
                  this.logger.log(
                    `✅ Subscription განახლებულია recurring payment-ისთვის!`,
                  );
                  this.logger.log(
                    '═══════════════════════════════════════════════════════',
                  );
                  this.logger.log(
                    `   • Next Billing Date: ${nextBillingDate.toISOString()}`,
                  );
                  this.logger.log(
                    `   • Billing Cycles: ${subscription.billingCycles + 1}`,
                  );
                  this.logger.log(
                    `   • Total Paid: ${subscription.totalPaid + subscription.planPrice}`,
                  );
                  this.logger.log(
                    '═══════════════════════════════════════════════════════',
                  );
                } else {
                  this.logger.warn(
                    `⚠️ Subscription ვერ მოიძებნა ID-ით: ${payment.recurringPaymentId}`,
                  );
                }
              } catch (error) {
                this.logger.error(
                  '❌ Subscription-ის განახლების შეცდომა recurring payment-ისთვის:',
                  error,
                );
              }
            }

            // თუ ეს არის recurring payment-ი დაშლილებისთვის და წარმატებულია, განვაახლოთ dismantler-ის expiryDate
            if (
              payment.isRecurring &&
              payment.recurringPaymentId &&
              payment.context === 'dismantler'
            ) {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  '🔄 Recurring payment-ისთვის დაშლილის განახლება',
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  `   • Recurring Payment ID: ${payment.recurringPaymentId}`,
                );
                this.logger.log(`   • Payment Status: completed`);

                const dismantler = await this.dismantlerModel
                  .findById(payment.recurringPaymentId)
                  .exec();

                if (dismantler) {
                  // გამოვთვალოთ შემდეგი expiry date (1 თვე ახლიდან)
                  const newExpiryDate = new Date();
                  newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

                  await this.dismantlerModel.findByIdAndUpdate(
                    payment.recurringPaymentId,
                    {
                      expiryDate: newExpiryDate,
                      status: 'active', // განვაახლოთ status active-ად
                      updatedAt: new Date(),
                    },
                  );

                  this.logger.log(
                    '═══════════════════════════════════════════════════════',
                  );
                  this.logger.log(
                    `✅ დაშლილი განახლებულია recurring payment-ისთვის!`,
                  );
                  this.logger.log(
                    '═══════════════════════════════════════════════════════',
                  );
                  this.logger.log(
                    `   • Dismantler ID: ${payment.recurringPaymentId}`,
                  );
                  this.logger.log(
                    `   • New Expiry Date: ${newExpiryDate.toISOString()}`,
                  );
                  this.logger.log(
                    '═══════════════════════════════════════════════════════',
                  );
                } else {
                  this.logger.warn(
                    `⚠️ Dismantler ვერ მოიძებნა ID-ით: ${payment.recurringPaymentId}`,
                  );
                }
              } catch (error) {
                this.logger.error(
                  '❌ Dismantler-ის განახლების შეცდომა recurring payment-ისთვის:',
                  error,
                );
              }
            }
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
            // გამოვიყენოთ იგივე external_order_id რომელიც ზემოთ განვსაზღვრეთ
            const externalOrderId = external_order_id || '';
            this.logger.log(
              `   • External Order ID (userId-ის მოსაძებნად): ${externalOrderId}`,
            );

            let userId = 'unknown';
            /** SubscriptionModal + payment-card: subscription_<planId>_<userId>_<timestamp> (planId-ში შეიძლება იყოს ჰიფენი, მაგ. premium-monthly) */
            let subscriptionParsedPlanId: string | undefined;

            this.logger.log(
              `   🔍 Pattern matching-ის ცდა: ${externalOrderId}`,
            );

            const subscriptionUserPlanMatch = externalOrderId.match(
              /^subscription_(.+?)_(usr_\d+|[a-f0-9]{24})_(\d{10,})$/i,
            );
            if (
              subscriptionUserPlanMatch &&
              subscriptionUserPlanMatch[1] &&
              subscriptionUserPlanMatch[2]
            ) {
              subscriptionParsedPlanId = subscriptionUserPlanMatch[1];
              userId = subscriptionUserPlanMatch[2];
              this.logger.log(
                `   ✅ Subscription external_order (app ფორმატი): planId=${subscriptionParsedPlanId}, userId=${userId}`,
              );
            }

            // BOG ზოგჯერ external_order_id-ს ამოჭრის/ცვლის — მოქნილი fallback
            if (userId === 'unknown' && externalOrderId) {
              const looseUsr = externalOrderId.match(/(usr_\d+)/);
              if (looseUsr) {
                userId = looseUsr[1];
                this.logger.log(`   ✅ User ID (loose usr_* match): ${userId}`);
              }
            }
            if (
              !subscriptionParsedPlanId &&
              externalOrderId.includes('subscription')
            ) {
              const planLoose = externalOrderId.match(
                /^subscription_(.+?)_usr_\d+/i,
              );
              if (planLoose?.[1]) {
                subscriptionParsedPlanId = planLoose[1];
                this.logger.log(
                  `   ✅ Plan ID (loose, subscription_*_usr_*): ${subscriptionParsedPlanId}`,
                );
              }
            }

            // Pattern: test_payment_1234567890_userId, test_subscription_1234567890_userId, carapp_1234567890_userId, store_payment_storeId_timestamp_userId
            const userIdMatch =
              userId !== 'unknown'
                ? null
                : externalOrderId.match(/test_payment_\d+_(.+)/) ||
                  externalOrderId.match(/test_subscription_\d+_(.+)/) ||
                  externalOrderId.match(/carapp_\d+_(.+)/) ||
                  // ძველი ფორმატი: subscription_<plan>_timestamp_<userId> (plan მხოლოდ word chars)
                  externalOrderId.match(/subscription_\w+_\d+_(.+)/) ||
                  externalOrderId.match(/store_payment_\w+_\d+_(.+)/) ||
                  externalOrderId.match(/recurring_.*_(\d+)$/);

            if (userId === 'unknown' && userIdMatch && userIdMatch[1]) {
              userId = userIdMatch[1];
              this.logger.log(`   ✅ User ID ნაპოვნია pattern-ით: ${userId}`);
            } else if (userId === 'unknown') {
              // თუ pattern-ით ვერ მოიძებნა, შევეცადოთ external_order_id-დან პირდაპირ მოვძებნოთ
              // ან შევამოწმოთ არსებული payment-ში external_order_id-ით
              this.logger.log(
                `   ⚠️ User ID pattern-ით ვერ მოიძებნა, ვცდილობთ payment-ის მოძებნას external_order_id-ით...`,
              );

              const existingPaymentForUserId = await this.paymentModel
                .findOne({
                  $or: [
                    { orderId: external_order_id },
                    { externalOrderId: external_order_id },
                  ],
                })
                .exec();

              this.logger.log(
                `   🔍 Payment ძებნის შედეგი: ${existingPaymentForUserId ? 'ნაპოვნია' : 'არ ნაპოვნია'}`,
              );

              if (
                existingPaymentForUserId &&
                existingPaymentForUserId.userId &&
                existingPaymentForUserId.userId !== 'unknown'
              ) {
                userId = existingPaymentForUserId.userId;
                this.logger.log(
                  `   ✅ User ID ნაპოვნია არსებული payment-იდან: ${userId}`,
                );
              } else {
                this.logger.log(
                  `   ⚠️ User ID ვერ მოიძებნა, გამოყენებული იქნება: ${userId}`,
                );
              }
            }

            // BOG callback-ის დეტალური მონაცემების მოპოვება
            const innerBody =
              callbackData.body?.body || callbackData.body || callbackData;
            const paymentDetail =
              innerBody?.payment_detail ||
              callbackData.body?.payment_detail ||
              callbackData.payment_detail;
            const orderStatus =
              innerBody?.order_status ||
              callbackData.body?.order_status ||
              callbackData.order_status;
            const purchaseUnits =
              innerBody?.purchase_units ||
              callbackData.body?.purchase_units ||
              callbackData.purchase_units;
            const redirectLinks =
              innerBody?.redirect_links ||
              callbackData.body?.redirect_links ||
              callbackData.redirect_links;
            const buyer =
              innerBody?.buyer ||
              callbackData.body?.buyer ||
              callbackData.buyer;

            // CarFAX პაკეტის credits-ის განსაზღვრა
            let credits: number | undefined;
            if (context === 'carfax-package') {
              // Credits-ის მიღება external_order_id-დან ან default 5
              // external_order_id format: carfax_package_userId_timestamp
              credits = 5; // Default credits for CarFAX package
              this.logger.log(
                `   📦 CarFAX პაკეტი გამოვლინდა, credits: ${credits}`,
              );
            }

            // Plan ID და Plan Name-ის მოძებნა external_order_id-დან ან არსებული payment-იდან
            let planId: string | undefined;
            let planName: string | undefined;
            let planPrice: string | undefined;
            let planCurrency: string | undefined;
            let planPeriod: string | undefined;

            // Plan ID external_order-იდან (იგივე პარსინგი რაც userId-სთვის ზემოთ)
            if (subscriptionParsedPlanId) {
              planId = subscriptionParsedPlanId;
              this.logger.log(
                `   ✅ Plan ID ნაპოვნია external_order_id-დან (app ფორმატი): ${planId}`,
              );
            } else {
              const planIdMatch = external_order_id.match(
                /subscription_(\w+)_\d+_(.+)/,
              );
              if (planIdMatch && planIdMatch[1]) {
                planId = planIdMatch[1];
                this.logger.log(
                  `   ✅ Plan ID ნაპოვნია external_order_id-დან (legacy): ${planId}`,
                );
              }
            }

            if (planId === 'premium-monthly') {
              planPeriod = planPeriod || 'თვეში';
              planName = planName || 'პრემიუმ - თვეში';
            } else if (
              planId === 'premium-6months' ||
              planId === 'premium-yearly'
            ) {
              planPeriod =
                planPeriod ||
                (planId === 'premium-yearly' ? 'წლიური' : '6 თვე');
              planName = planName || 'პრემიუმ';
            } else if (planId === 'basic') {
              planPeriod = planPeriod || 'უფასო';
              planName = planName || 'ძირითადი';
            }

            // თუ planId ვერ მოიძებნა, შევამოწმოთ არსებული payment-ში (external_order_id-ით)
            if (!planId) {
              const existingPaymentForPlan = await this.paymentModel
                .findOne({
                  $or: [
                    { orderId: external_order_id },
                    { externalOrderId: external_order_id },
                  ],
                })
                .exec();

              if (existingPaymentForPlan?.metadata?.planId) {
                planId = existingPaymentForPlan.metadata.planId;
                planName = existingPaymentForPlan.metadata.planName;
                planPrice = existingPaymentForPlan.metadata.planPrice;
                planCurrency = existingPaymentForPlan.metadata.planCurrency;
                planPeriod = existingPaymentForPlan.metadata.planPeriod;
                this.logger.log(
                  `   ✅ Plan ID ნაპოვნია არსებული payment-იდან: ${planId}`,
                );
              }
            }

            // თუ planPrice არ არის, გამოვიყენოთ amount
            if (!planPrice && amount) {
              planPrice = amount.toString();
            }

            // თუ planCurrency არ არის, გამოვიყენოთ currency
            if (!planCurrency && currency) {
              planCurrency = currency;
            }

            // თუ planPeriod არ არის, განვსაზღვროთ planId-დან
            if (!planPeriod && planId) {
              if (planId === 'premium-monthly') {
                planPeriod = 'თვეში';
              } else if (planId === 'basic') {
                planPeriod = 'უფასო';
              }
            }

            // თუ planName არ არის, განვსაზღვროთ planId-დან
            if (!planName && planId) {
              if (planId === 'premium-monthly') {
                planName = 'პრემიუმ - თვეში';
              } else if (planId === 'basic') {
                planName = 'ძირითადი';
              }
            }

            // შევქმნათ payment record BOG callback-ის ყველა მონაცემით
            const paymentData: any = {
              userId: userId,
              orderId: order_id,
              amount: amount || 0,
              currency: currency || 'GEL',
              paymentMethod: 'BOG',
              status: 'completed',
              context: context,
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
                planId: planId,
                planName: planName,
                planPrice: planPrice,
                planCurrency: planCurrency,
                planPeriod: planPeriod,
                // CarFAX პაკეტის credits (თუ context არის carfax-package)
                ...(credits !== undefined && { credits }),
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
                  reject_reason:
                    callbackData.reject_reason || innerBody?.reject_reason,
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
            this.logger.log(
              `   • Created At: ${newPayment.createdAt?.toISOString() || 'N/A'}`,
            );
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

            // ბარათის დამახსოვრება უკვე მოხდა createOrder-ის შემდეგ, გადამისამართებამდე
            // BOG API დოკუმენტაციის მიხედვით, ბარათის დამახსოვრება უნდა მოხდეს
            // შეკვეთის შექმნის შემდეგ, გადახდების გვერდზე მომხმარებლის გადამისამართებამდე

            // CarFAX პაკეტის დამატება (თუ context არის 'carfax-package')
            // გამოვიყენოთ payment-ის context, მაგრამ თუ ის არ არის სწორი, გამოვიყენოთ განსაზღვრული context
            const paymentContext = payment.context || context || '';
            this.logger.log(
              `   🔍 Payment Context: ${paymentContext}, განსაზღვრული Context: ${context}`,
            );
            if (paymentContext === 'carfax-package') {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log('📦 CarFAX პაკეტის დამატება payment-ის შემდეგ');
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`   • User ID: ${payment.userId}`);
                this.logger.log(
                  `   • Amount: ${payment.amount} ${payment.currency}`,
                );
                this.logger.log(`   • Context: ${context}`);

                // Credits-ის მიღება metadata-დან
                const credits: number = payment.metadata?.credits || 5;
                this.logger.log(`   • Credits: ${credits}`);

                const packageResult = await this.carfaxService.addCarFAXPackage(
                  payment.userId,
                  credits,
                );

                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`✅ CarFAX პაკეტი წარმატებით დაემატა!`);
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`   • User ID: ${payment.userId}`);
                this.logger.log(
                  `   • Total Limit: ${packageResult.totalLimit}`,
                );
                this.logger.log(`   • Used: ${packageResult.used}`);
                this.logger.log(`   • Remaining: ${packageResult.remaining}`);
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
              } catch (error) {
                this.logger.error(
                  '❌ CarFAX პაკეტის დამატების შეცდომა:',
                  error,
                );
              }
            }

            // Store-ის განახლება (თუ context არის 'store-payment')
            if (
              paymentContext === 'store-payment' ||
              external_order_id.includes('store_payment')
            ) {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log('🏪 Store-ის განახლება payment-ის შემდეგ');
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );

                // Store ID-ის მოძებნა external_order_id-დან
                // Format: store_payment_storeId_timestamp_userId
                const storeIdMatch = external_order_id.match(
                  /store_payment_(\w+)_\d+_/,
                );
                if (storeIdMatch && storeIdMatch[1]) {
                  const storeId = storeIdMatch[1];
                  this.logger.log(`   • Store ID: ${storeId}`);
                  this.logger.log(`   • Payment Amount: ${amount} ${currency}`);

                  const now = new Date();
                  const nextPaymentDate = new Date(now);
                  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

                  // Store-ის მოძებნა და განახლება
                  const store = await this.storesService.findOne(storeId);
                  if (store) {
                    const currentTotalPaid = store.totalPaid || 0;
                    const paymentAmount = amount || store.paymentAmount || 9.99;

                    await this.storesService.update(storeId, {
                      lastPaymentDate: now.toISOString(),
                      nextPaymentDate: nextPaymentDate.toISOString(),
                      paymentStatus: 'paid',
                      totalPaid: currentTotalPaid + paymentAmount,
                    });

                    this.logger.log(
                      '═══════════════════════════════════════════════════════',
                    );
                    this.logger.log(`✅ Store განახლებულია!`);
                    this.logger.log(
                      '═══════════════════════════════════════════════════════',
                    );
                    this.logger.log(`   • Store ID: ${storeId}`);
                    this.logger.log(
                      `   • Last Payment Date: ${now.toISOString()}`,
                    );
                    this.logger.log(
                      `   • Next Payment Date: ${nextPaymentDate.toISOString()}`,
                    );
                    this.logger.log(
                      `   • Total Paid: ${currentTotalPaid + paymentAmount}`,
                    );
                    this.logger.log(
                      '═══════════════════════════════════════════════════════',
                    );
                  } else {
                    this.logger.error(
                      `❌ Store ვერ მოიძებნა ID-ით: ${storeId}`,
                    );
                  }
                } else {
                  this.logger.error(
                    `❌ Store ID ვერ მოიძებნა external_order_id-დან: ${external_order_id}`,
                  );
                }
              } catch (error) {
                this.logger.error('❌ Store-ის განახლების შეცდომა:', error);
              }
            }

            // დაშლილი / სერვისი / ხელოსანი / მაღაზია — BOG-ზე ბარათის დამახსოვრება (recurring / subscribe API)
            const recurringListingContexts = [
              'dismantler',
              'service',
              'mechanic',
              'store',
            ];
            if (recurringListingContexts.includes(paymentContext)) {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  `💾 ბარათის დამახსოვრება recurring-ისთვის (context: ${paymentContext})`,
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`   • Order ID: ${order_id}`);
                this.logger.log(
                  `   • BOG Card Token (bogCardToken): ${order_id}`,
                );
                await this.bogPaymentService.saveCardForRecurringPayments(
                  order_id,
                );
                this.logger.log(
                  `✅ ბარათი დამახსოვრებულია (${paymentContext}) recurring-ისთვის, order_id: ${order_id}`,
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
              } catch (saveCardError) {
                const errorMessage =
                  saveCardError instanceof Error
                    ? saveCardError.message
                    : 'Unknown error';

                this.logger.warn(
                  `⚠️ ბარათის დამახსოვრება ვერ მოხერხდა (${paymentContext}): ${errorMessage}`,
                );
                this.logger.warn(`   • Order ID: ${order_id}`);
              }
            }

            // Subscription-ის შექმნა (თუ context არის 'subscription' ან 'test_subscription' ან 'test')
            // გამოვიყენოთ payment-ის context, მაგრამ თუ ის არ არის სწორი, გამოვიყენოთ განსაზღვრული context
            const subscriptionContext = paymentContext || context || '';
            if (
              subscriptionContext === 'subscription' ||
              subscriptionContext === 'test_subscription' ||
              subscriptionContext === 'test'
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

                // Plan ID და Plan Name-ის მიღება payment metadata-დან
                this.logger.log(
                  '🔍 Payment Metadata-დან Plan ინფორმაციის მიღება:',
                );
                this.logger.log(
                  `   • Full metadata: ${JSON.stringify(payment.metadata || {}, null, 2)}`,
                );

                const planId = payment.metadata?.planId;
                const planName = payment.metadata?.planName;
                const planPeriodFromMetadata = payment.metadata?.planPeriod;

                if (planId) {
                  this.logger.log(
                    `   ✅ Plan ID ნაპოვნია metadata-ში: ${planId}`,
                  );
                } else {
                  this.logger.warn(
                    `   ⚠️ Plan ID არ არის metadata-ში! ეს შეიძლება გამოიწვიოს default plan-ის გამოყენება.`,
                  );
                }

                if (planName) {
                  this.logger.log(
                    `   ✅ Plan Name ნაპოვნია metadata-ში: ${planName}`,
                  );
                } else {
                  this.logger.warn(
                    `   ⚠️ Plan Name არ არის metadata-ში! ეს შეიძლება გამოიწვიოს default plan-ის გამოყენება.`,
                  );
                }

                if (planPeriodFromMetadata) {
                  this.logger.log(
                    `   ✅ Plan Period ნაპოვნია metadata-ში: ${planPeriodFromMetadata}`,
                  );
                } else {
                  this.logger.warn(
                    `   ⚠️ Plan Period არ არის metadata-ში! გამოყენებული იქნება default: monthly`,
                  );
                }

                const subscription =
                  await this.subscriptionsService.createSubscriptionFromPayment(
                    payment.userId,
                    order_id, // ეს არის create-order response-ის order_id (parent order_id)
                    payment.amount,
                    payment.currency,
                    context,
                    planId,
                    planName,
                    planPeriodFromMetadata, // planPeriod-ის გადაცემა
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

                // ბარათის დამახსოვრება recurring payments-ისთვის (callback-ის დროს)
                // ეს აუცილებელია რადგან შეიძლება createOrder-ის შემდეგ saveCardForRecurringPayments ვერ მოხერხდა
                // ვამოწმებთ orderStatus-ს (რომელიც განსაზღვრულია callback-ის დასაწყისში)
                const currentOrderStatus =
                  innerBody?.order_status ||
                  callbackData.body?.order_status ||
                  callbackData.order_status;

                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  '💾 ბარათის დამახსოვრების მცდელობა recurring payments-ისთვის',
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(`   • Order ID: ${order_id}`);
                this.logger.log(
                  `   • Order Status: ${currentOrderStatus?.value || 'N/A'}`,
                );
                this.logger.log(
                  `   • Subscription ID: ${String(subscription._id)}`,
                );
                this.logger.log(
                  `   • BOG Token (bogCardToken): ${subscription.bogCardToken || 'N/A'}`,
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );

                if (
                  order_id &&
                  (currentOrderStatus?.value === 'completed' ||
                    currentOrderStatus?.value === 'success')
                ) {
                  // ამიტომ ვიყენებთ payment.metadata-დან
                  const parentOrderId =
                    payment.metadata?.bogCallbackData?.payment_detail
                      ?.parent_order_id;

                  let correctBogCardToken = order_id;

                  // თუ ეს არის პირველი payment-ი (არ აქვს parentOrderId)
                  // მაშინ bogCardToken უნდა იყოს ამ order_id (პირველი payment-ის orderId)
                  if (!parentOrderId) {
                    correctBogCardToken = order_id;
                    this.logger.log(
                      `   • პირველი payment-ი subscription-ისთვის, bogCardToken: ${correctBogCardToken}`,
                    );
                  }
                  // თუ ეს არის recurring payment-ი (აქვს parentOrderId)
                  // მაშინ bogCardToken უნდა იყოს parentOrderId (პირველი payment-ის orderId)
                  else if (parentOrderId) {
                    correctBogCardToken = parentOrderId;
                    this.logger.log(
                      `   • Recurring payment-ი, bogCardToken უნდა იყოს parentOrderId: ${correctBogCardToken}`,
                    );
                  }

                  // განვაახლოთ subscription-ის bogCardToken თუ არასწორია
                  // ეს აუცილებელია რომ recurring payments მუშაობდეს
                  const previousBogCardToken = subscription.bogCardToken;
                  if (
                    !subscription.bogCardToken ||
                    subscription.bogCardToken !== correctBogCardToken
                  ) {
                    subscription.bogCardToken = correctBogCardToken;
                    await subscription.save();
                    this.logger.log(
                      `✅ Subscription-ის bogCardToken განახლებულია: ${correctBogCardToken}`,
                    );
                    this.logger.log(
                      `   • წინა bogCardToken: ${previousBogCardToken || 'N/A'}`,
                    );
                    this.logger.log(
                      `   • ახალი bogCardToken: ${correctBogCardToken}`,
                    );
                    this.logger.log(
                      `   • 💡 ახლა შესაძლებელია recurring payments-ის გაკეთება ამ bogCardToken-ით`,
                    );
                  } else {
                    this.logger.log(
                      `✅ Subscription-ის bogCardToken უკვე სწორია: ${correctBogCardToken}`,
                    );
                  }
                  try {
                    this.logger.log(
                      '💾 ბარათის დამახსოვრება recurring payments-ისთვის (callback-ის დროს)...',
                    );
                    this.logger.log(`   • Order ID: ${order_id}`);
                    this.logger.log(
                      `   • BOG Card Token (bogCardToken): ${correctBogCardToken}`,
                    );
                    await this.bogPaymentService.saveCardForRecurringPayments(
                      order_id,
                    );
                    this.logger.log(
                      `✅ ბარათი დამახსოვრებულია recurring payments-ისთვის order_id: ${order_id}-ისთვის`,
                    );
                  } catch (saveCardError) {
                    // ბარათის დამახსოვრების შეცდომა არ უნდა შეაჩეროს subscription-ის შექმნა
                    // bogCardToken მაინც ინახება subscription-ში და შესაძლებელია recurring payments-ის გაკეთება
                    const errorMessage =
                      saveCardError instanceof Error
                        ? saveCardError.message
                        : 'Unknown error';

                    this.logger.warn(
                      `⚠️ ბარათის დამახსოვრება ვერ მოხერხდა callback-ის დროს: ${errorMessage}`,
                    );
                    this.logger.warn(
                      '   • ეს შეიძლება იყოს ნორმალური თუ ბარათი უკვე დამახსოვრებულია',
                    );
                    this.logger.warn(
                      '   • ან შეიძლება იყოს პრობლემა BOG API-სთან',
                    );
                    this.logger.warn(
                      `   • მაგრამ bogCardToken მაინც ინახება subscription-ში: ${correctBogCardToken}`,
                    );
                    this.logger.warn(
                      '   • Subscription მაინც შეიქმნა, recurring payments შესაძლებელია მუშაობდეს',
                    );
                  }
                } else {
                  this.logger.warn(
                    '⚠️ ბარათის დამახსოვრება გამოტოვებულია, რადგან order status არ არის completed/success',
                  );
                  this.logger.warn(
                    `   • Order Status: ${currentOrderStatus?.value || 'N/A'}`,
                  );
                }
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

            // CarFinesSubscription-ის აქტივაცია (თუ context არის 'car_fines_subscription')
            if (
              paymentContext === 'car_fines_subscription' ||
              context === 'car_fines_subscription'
            ) {
              try {
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
                this.logger.log(
                  '🚗 CarFinesSubscription-ის აქტივაცია payment-ის შემდეგ',
                );
                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );

                const carFinesSubId = payment.metadata?.carFinesSubscriptionId;
                const carId = payment.metadata?.carId;

                this.logger.log(
                  `   • CarFinesSubscription ID: ${carFinesSubId || 'N/A'}`,
                );
                this.logger.log(`   • Car ID: ${carId || 'N/A'}`);
                this.logger.log(`   • Order ID: ${order_id}`);

                if (carFinesSubId) {
                  // გადახდის დადასტურება და bogCardToken-ის შენახვა
                  const activatedSub =
                    await this.finesService.confirmCarFinesPayment(
                      carFinesSubId,
                      order_id, // transactionId
                      order_id, // bogCardToken — recurring payments-ისთვის
                    );

                  this.logger.log(
                    `✅ CarFinesSubscription აქტივირებულია: ${String(activatedSub._id)}`,
                  );
                  this.logger.log(
                    `   • Vehicle: ${activatedSub.vehicleNumber}`,
                  );
                  this.logger.log(
                    `   • bogCardToken: ${activatedSub.bogCardToken || 'N/A'}`,
                  );
                  this.logger.log(
                    `   • Next Billing: ${activatedSub.nextBillingDate?.toISOString() || 'N/A'}`,
                  );

                  // ბარათის დამახსოვრება recurring payments-ისთვის
                  try {
                    await this.bogPaymentService.saveCardForRecurringPayments(
                      order_id,
                    );
                    this.logger.log(
                      `✅ ბარათი დამახსოვრებულია CarFinesSubscription recurring payments-ისთვის`,
                    );
                  } catch (saveCardError) {
                    this.logger.warn(
                      `⚠️ ბარათის დამახსოვრება ვერ მოხერხდა CarFinesSubscription-ისთვის: ${
                        saveCardError instanceof Error
                          ? saveCardError.message
                          : 'Unknown error'
                      }`,
                    );
                  }
                } else if (carId) {
                  // თუ subscriptionId არ არის, მაგრამ carId-ით ვპოულობთ
                  const existingSub =
                    await this.finesService.findCarFinesSubscriptionByCarId(
                      carId,
                    );
                  if (existingSub) {
                    await this.finesService.confirmCarFinesPayment(
                      String(existingSub._id),
                      order_id,
                      order_id,
                    );
                    this.logger.log(
                      `✅ CarFinesSubscription აქტივირებულია carId-ით: ${carId}`,
                    );
                  } else {
                    this.logger.warn(
                      `⚠️ CarFinesSubscription ვერ მოიძებნა carId-ით: ${carId}`,
                    );
                  }
                } else {
                  this.logger.warn(
                    '⚠️ CarFinesSubscription ID ან Car ID არ არის metadata-ში',
                  );
                }

                this.logger.log(
                  '═══════════════════════════════════════════════════════',
                );
              } catch (carFinesError) {
                this.logger.error(
                  '❌ CarFinesSubscription-ის აქტივაციის შეცდომა:',
                  carFinesError instanceof Error
                    ? carFinesError.message
                    : 'Unknown error',
                );
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
   * გამოიყენება წარმატებული გადახდის parent_order_id, რომელზეც მოხდა ბარათის დამახსოვრება
   * BOG API დოკუმენტაციის მიხედვით, body-ში optional-ია callback_url და external_order_id
   * სხვა პარამეტრები (თანხა, ვალუტა, მყიდველის ინფორმაცია) ავტომატურად იღება parent_order_id-დან
   *
   * @see https://api.bog.ge/docs/payments/recurring-payments
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

  /**
   * ბარათის დამახსოვრების ტესტი კონკრეტული order_id-ით
   * PUT /bog/save-card/:orderId
   */
  @Put('save-card/:orderId')
  @HttpCode(HttpStatus.ACCEPTED)
  async testSaveCard(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`🧪 ბარათის დამახსოვრების ტესტი order_id: ${orderId}-ით`);

      await this.bogPaymentService.saveCardForRecurringPayments(orderId);

      this.logger.log(
        `✅ ბარათის დამახსოვრების ტესტი წარმატებით დასრულდა order_id: ${orderId}-ით`,
      );

      return {
        success: true,
        message: 'ბარათი წარმატებით დამახსოვრებულია',
        orderId: orderId,
      };
    } catch (error: unknown) {
      this.logger.error(
        `❌ ბარათის დამახსოვრების ტესტის შეცდომა order_id: ${orderId}-ით:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      return {
        success: false,
        message: 'ბარათის დამახსოვრება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
