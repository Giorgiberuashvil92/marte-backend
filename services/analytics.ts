import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  private isEnabled = true;

  // Initialize analytics
  async initialize() {
    try {
      await analytics().setAnalyticsCollectionEnabled(true);
      console.log('✅ Firebase Analytics initialized');
    } catch (error) {
      console.error('❌ Error initializing Analytics:', error);
      this.isEnabled = false;
    }
  }

  // Log screen view (fire-and-forget for performance)
  logScreenView(screenName: string, screenClass?: string) {
    if (!this.isEnabled) return;
    analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    }).catch(() => {
    });
  }

  // Log custom event (fire-and-forget for performance)
  logEvent(eventName: string, params?: Record<string, any>) {
    if (!this.isEnabled) return;
    // Fire and forget - don't block UI
    analytics().logEvent(eventName, params).catch(() => {
      // Silently fail - analytics should never block the app
    });
  }

  // Set user properties (fire-and-forget for performance)
  setUserProperties(properties: Record<string, string>) {
    if (!this.isEnabled) return;
    // Fire and forget - don't block UI
    Promise.all(
      Object.entries(properties).map(([key, value]) =>
        analytics().setUserProperty(key, value)
      )
    ).catch(() => {
      // Silently fail - analytics should never block the app
    });
  }

  // Set user ID (fire-and-forget for performance)
  setUserId(userId: string) {
    if (!this.isEnabled) return;
    // Fire and forget - don't block UI
    analytics().setUserId(userId).catch(() => {
      // Silently fail - analytics should never block the app
    });
  }

  // Reset analytics (on logout) - fire-and-forget
  reset() {
    if (!this.isEnabled) return;
    // Fire and forget - don't block UI
    analytics().resetAnalyticsData().catch(() => {
      // Silently fail - analytics should never block the app
    });
  }

  // Predefined events for common actions
  
  // Service events (all fire-and-forget)
  logServiceViewed(serviceId: string, serviceName: string, category: string) {
    this.logEvent('service_viewed', {
      service_id: serviceId,
      service_name: serviceName,
      category: category,
    });
  }

  logServiceSearched(searchQuery: string, resultsCount: number) {
    this.logEvent('service_searched', {
      search_term: searchQuery,
      results_count: resultsCount,
    });
  }

  // Booking events
  logBookingCreated(bookingId: string, serviceType: string, price?: number) {
    this.logEvent('booking_created', {
      booking_id: bookingId,
      service_type: serviceType,
      value: price,
      currency: 'GEL',
    });
  }

  logBookingCancelled(bookingId: string, serviceType: string) {
    this.logEvent('booking_cancelled', {
      booking_id: bookingId,
      service_type: serviceType,
    });
  }

  // Parts events
  logPartViewed(partId: string, partName: string, category: string) {
    this.logEvent('part_viewed', {
      part_id: partId,
      part_name: partName,
      category: category,
    });
  }

  logPartSearched(searchQuery: string, resultsCount: number) {
    this.logEvent('part_searched', {
      search_term: searchQuery,
      results_count: resultsCount,
    });
  }

  // User events
  logUserRegistered(userId: string, method: string) {
    this.logEvent('sign_up', {
      method: method,
    });
    this.setUserId(userId);
  }

  logUserLogin(userId: string, method: string) {
    this.logEvent('login', {
      method: method,
    });
    this.setUserId(userId);
  }

  // Call events
  logCallInitiated(phoneNumber: string, serviceType: string) {
    this.logEvent('call_initiated', {
      phone_number: phoneNumber.replace(/\d/g, '*'), // Privacy: mask phone
      service_type: serviceType,
    });
  }

  // Navigation events
  logNavigation(from: string, to: string) {
    this.logEvent('navigation', {
      from_screen: from,
      to_screen: to,
    });
  }

  // Filter events
  logFilterApplied(filterType: string, filterValue: string) {
    this.logEvent('filter_applied', {
      filter_type: filterType,
      filter_value: filterValue,
    });
  }

  // Share events
  logShare(contentType: string, itemId: string) {
    this.logEvent('share', {
      content_type: contentType,
      item_id: itemId,
    });
  }

  // Button click events
  logButtonClick(buttonName: string, screen: string, additionalParams?: Record<string, any>, userId?: string) {
    this.logEvent('button_click', {
      button_name: buttonName,
      screen: screen,
      ...additionalParams,
    });
    
    // Also track in backend
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('button_click', buttonName, userId, screen, additionalParams).catch(() => {
          // Silently fail
        });
      }).catch(() => {
        // Silently fail
      });
    }
  }

  // Home page specific events
  logHomePageAction(action: string, target?: string) {
    this.logEvent('home_page_action', {
      action: action,
      target: target,
      screen: 'home',
    });
  }

  // Screen view with backend tracking
  logScreenViewWithBackend(screenName: string, screenClass?: string, userId?: string) {
    this.logScreenView(screenName, screenClass);
    
    // Also track in backend
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('screen_view', screenName, userId, screenName).catch(() => {
          // Silently fail
        });
      }).catch(() => {
        // Silently fail
      });
    }
  }

  // Navigation with backend tracking
  logNavigationWithBackend(from: string, to: string, userId?: string) {
    this.logNavigation(from, to);
    
    // Also track in backend
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('navigation', `${from} -> ${to}`, userId, from, {
          from_screen: from,
          to_screen: to,
        }).catch(() => {
          // Silently fail
        });
      }).catch(() => {
        // Silently fail
      });
    }
  }

  // Session duration tracking
  logSessionStart(userId?: string) {
    const sessionStartTime = Date.now();
    // Use 'app_session_start' instead of 'session_start' because 'session_start' is reserved by Firebase
    this.logEvent('app_session_start', {
      timestamp: sessionStartTime,
    });
    
    // Also track in backend
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('session_start', 'სესიის დაწყება', userId, undefined, {
          timestamp: sessionStartTime,
        }).catch(() => {
          // Silently fail
        });
      }).catch(() => {
        // Silently fail
      });
    }
    
    return sessionStartTime;
  }

  logSessionEnd(userId?: string, sessionStartTime?: number) {
    const sessionEndTime = Date.now();
    const duration = sessionStartTime ? sessionEndTime - sessionStartTime : 0;
    
    this.logEvent('session_end', {
      duration_seconds: Math.round(duration / 1000),
      duration_minutes: Math.round(duration / 60000 * 10) / 10,
      timestamp: sessionEndTime,
    });
    
    // Also track in backend
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('session_end', 'სესიის დასრულება', userId, undefined, {
          duration_seconds: Math.round(duration / 1000),
          duration_minutes: Math.round(duration / 60000 * 10) / 10,
          timestamp: sessionEndTime,
        }).catch(() => {
          // Silently fail
        });
      }).catch(() => {
        // Silently fail
      });
    }
  }

  // Category tracking
  logCategoryView(categoryId: string, categoryName: string, userId?: string) {
    this.logEvent('category_view', {
      category_id: categoryId,
      category_name: categoryName,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('category_view', categoryName, userId, 'კატეგორია', {
          category_id: categoryId,
          category_name: categoryName,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  logCategoryClick(categoryId: string, categoryName: string, sourceScreen: string, userId?: string) {
    this.logEvent('category_click', {
      category_id: categoryId,
      category_name: categoryName,
      source_screen: sourceScreen,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('category_click', categoryName, userId, sourceScreen, {
          category_id: categoryId,
          category_name: categoryName,
          source_screen: sourceScreen,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  // Map tracking
  logMapView(userId?: string) {
    this.logEvent('map_view', {});
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('map_view', 'რუკის ნახვა', userId, 'რუკა').catch(() => {});
      }).catch(() => {});
    }
  }

  logMapCategoryFilter(categoryId: string, categoryName: string, action: 'selected' | 'deselected', userId?: string) {
    this.logEvent('map_category_filter', {
      category_id: categoryId,
      category_name: categoryName,
      action: action,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('map_category_filter', `${categoryName} - ${action === 'selected' ? 'არჩეული' : 'გაუქმებული'}`, userId, 'რუკა', {
          category_id: categoryId,
          category_name: categoryName,
          action: action,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  logMapMarkerClick(markerId: string, markerName: string, markerType: string, userId?: string) {
    this.logEvent('map_marker_click', {
      marker_id: markerId,
      marker_name: markerName,
      marker_type: markerType,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('map_marker_click', markerName, userId, 'რუკა', {
          marker_id: markerId,
          marker_name: markerName,
          marker_type: markerType,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  // CredoBank banner tracking
  logCredoBankBannerView(userId?: string) {
    this.logEvent('credo_bank_banner_view', {});
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('banner_view', 'კრედობანკის ბანერი', userId, 'მთავარი', {
          banner_type: 'credo_bank',
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  logCredoBankBannerClick(userId?: string, action?: string) {
    this.logEvent('credo_bank_banner_click', {
      action: action || 'click',
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('banner_click', 'კრედობანკის ბანერი', userId, 'მთავარი', {
          banner_type: 'credo_bank',
          action: action || 'click',
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  logCredoBankBannerTimeSpent(durationSeconds: number, userId?: string) {
    this.logEvent('credo_bank_banner_time_spent', {
      duration_seconds: durationSeconds,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('banner_time_spent', 'კრედობანკის ბანერი', userId, 'მთავარი', {
          banner_type: 'credo_bank',
          duration_seconds: durationSeconds,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  // Sales/Marketplace tracking
  logSalesPageView(pageName: string, userId?: string) {
    this.logEvent('sales_page_view', {
      page_name: pageName,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('sales_page_view', pageName, userId, pageName).catch(() => {});
      }).catch(() => {});
    }
  }

  logSalesItemClick(itemId: string, itemName: string, itemType: string, pageName: string, userId?: string) {
    this.logEvent('sales_item_click', {
      item_id: itemId,
      item_name: itemName,
      item_type: itemType,
      page_name: pageName,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('sales_item_click', itemName, userId, pageName, {
          item_id: itemId,
          item_name: itemName,
          item_type: itemType,
          page_name: pageName,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  logSalesItemView(itemId: string, itemName: string, itemType: string, pageName: string, userId?: string) {
    this.logEvent('sales_item_view', {
      item_id: itemId,
      item_name: itemName,
      item_type: itemType,
      page_name: pageName,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('sales_item_view', itemName, userId, pageName, {
          item_id: itemId,
          item_name: itemName,
          item_type: itemType,
          page_name: pageName,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  logSalesItemImpression(itemId: string, itemName: string, itemType: string, pageName: string, userId?: string, additionalParams?: Record<string, any>) {
    this.logEvent('sales_item_impression', {
      item_id: itemId,
      item_name: itemName,
      item_type: itemType,
      page_name: pageName,
      ...additionalParams,
    });
    
    if (typeof fetch !== 'undefined') {
      import('./analyticsApi').then(({ analyticsApi }) => {
        analyticsApi.trackEvent('sales_item_impression', itemName, userId, pageName, {
          item_id: itemId,
          item_name: itemName,
          item_type: itemType,
          page_name: pageName,
          ...additionalParams,
        }).catch(() => {});
      }).catch(() => {});
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;

