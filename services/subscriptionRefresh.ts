/**
 * საბსქრიფშენის განახლების ტრიგერი push-ის შემდეგ.
 * UserContext იძახებს triggerSubscriptionRefresh()-ს, SubscriptionContext რეგისტრირებს callback-ს.
 */
let subscriptionRefreshCallback: (() => void) | null = null;

export function setSubscriptionRefreshCallback(cb: (() => void) | null) {
  subscriptionRefreshCallback = cb;
}

export function triggerSubscriptionRefresh() {
  if (subscriptionRefreshCallback) {
    subscriptionRefreshCallback();
  }
}
