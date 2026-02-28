import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKIE_CONSENT_KEY = '@marte_cookie_consent';
const COOKIE_PREFERENCES_KEY = '@marte_cookie_preferences';

interface CookiePreferences {
  essential: boolean;
  performance: boolean;
  functional: boolean;
  advertising: boolean;
}

interface CookiePolicyModalProps {
  visible: boolean;
  onAccept: (preferences?: CookiePreferences) => void;
  onReject: () => void;
}

export default function CookiePolicyModal({
  visible,
  onAccept,
  onReject,
}: CookiePolicyModalProps) {
  const [showFullText, setShowFullText] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, can't be disabled
    performance: true,
    functional: true,
    advertising: true,
  });

  const handleAcceptAll = () => {
    saveCookieConsent('accepted', preferences);
    onAccept(preferences);
  };

  const handleReject = () => {
    const rejectedPrefs: CookiePreferences = {
      essential: true, // Always true
      performance: false,
      functional: false,
      advertising: false,
    };
    saveCookieConsent('rejected', rejectedPrefs);
    onAccept(rejectedPrefs);
  };

  const handleCustomize = () => {
    setShowPreferences(true);
  };

  const handleSavePreferences = () => {
    saveCookieConsent('custom', preferences);
    onAccept(preferences);
  };

  const saveCookieConsent = async (
    status: 'accepted' | 'rejected' | 'custom',
    prefs: CookiePreferences,
  ) => {
    try {
      await AsyncStorage.setItem(COOKIE_CONSENT_KEY, status);
      await AsyncStorage.setItem(
        COOKIE_PREFERENCES_KEY,
        JSON.stringify(prefs),
      );
    } catch (error) {
      console.error('Error saving cookie consent:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFC']}
            style={styles.modalContent}
          >
            {!showFullText && !showPreferences ? (
              <>
                {/* Short Banner */}
                <View style={styles.header}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="document-text-outline" size={32} color="#6366F1" />
                  </View>
                  <Text style={styles.title}>Cookie Policy</Text>
                </View>

                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.description}>
                    ჩვენ ვიყენებთ ქუქი-ფაილებს მომხმარებლის გამოცდილების
                    გაუმჯობესებისა და პერსონალიზებისთვის, ინტერესებზე მორგებული
                    რეკლამების მიწოდებისა და სტატისტიკური ანალიტიკის
                    განხორციელების მიზნით. ვებსაიტის, აპლიკაციისა და სერვისების
                    გამოყენებით, თქვენ აცხადებთ თანხმობას ქუქი-ფაილების გამოყენებაზე
                    ჩვენი ქუქი-ფაილების პოლიტიკის შესაბამისად.
                  </Text>

                  <TouchableOpacity
                    onPress={() => setShowFullText(true)}
                    style={styles.readMoreButton}
                  >
                    <Text style={styles.readMoreText}>
                      სრული ტექსტის წაკითხვა
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#6366F1" />
                  </TouchableOpacity>
                </ScrollView>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleReject}
                    style={[styles.button, styles.rejectButton]}
                  >
                    <Text style={styles.rejectButtonText}>უარყოფა</Text>
                  </TouchableOpacity>

                 

                  <TouchableOpacity
                    onPress={handleAcceptAll}
                    style={[styles.button, styles.acceptButton]}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      style={styles.acceptButtonGradient}
                    >
                      <Text style={styles.acceptButtonText}>დათანხმება</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : showFullText ? (
              <>
                {/* Full Text View */}
                <View style={styles.fullTextHeader}>
                  <TouchableOpacity
                    onPress={() => setShowFullText(false)}
                    style={styles.backButton}
                  >
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.fullTextTitle}>
                    ქუქი-ფაილების პოლიტიკა
                  </Text>
                  <View style={styles.backButton} />
                </View>

                <ScrollView
                  style={styles.fullTextScrollView}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.fullTextContent}>
                    <Text style={styles.sectionTitle}>
                      1. რა არის ქუქი-ფაილები?
                    </Text>
                    <Text style={styles.sectionText}>
                      ქუქი-ფაილები არის მცირე ზომის ტექსტური ფაილები, რომლებიც
                      იტვირთება თქვენს მოწყობილობაზე (მაგალითად, ბრაუზერში)
                      ვებსაიტის/აპლიკაციის გამოყენებისას. ქუქი-ფაილები
                      საშუალებას აძლევს ვებსაიტს/აპლიკაციას „დაიმახსოვროს“
                      ინფორმაცია თქვენს შესახებ, რაც აუმჯობესებს მომხმარებლის
                      გამოცდილებას, იძლევა ანგარიშის მართვის შესაძლებლობას და
                      უზრუნველყოფს სერვისების გამართულ ფუნქციონირებას.
                    </Text>

                    <Text style={styles.sectionTitle}>
                      2. როგორ ვიყენებთ ქუქი-ფაილებს?
                    </Text>
                    <Text style={styles.sectionText}>
                      არჩევითი ქუქი-ფაილები შეიძლება იყოს როგორც პირველი მხარის
                      ქუქი-ფაილები, ასევე მესამე მხარის ქუქი-ფაილები. პირველი
                      მხარის ქუქი-ფაილები განთავსებულია უშუალოდ ჩვენი
                      ვებსაიტის მიერ ან ჩვენი მოთხოვნით; მესამე მხარის
                      ქუქი-ფაილები განთავსებულია მესამე პირების მიერ,
                      მაგალითად ანალიტიკური ან სარეკლამო სერვისების
                      მომწოდებლების მიერ.
                    </Text>
                    <Text style={styles.sectionText}>
                      ჩვენ და ჩვენი პარტნიორები (მაგ., ანალიტიკური და სარეკლამო
                      სერვისების მიმწოდებლები) ვიყენებთ ქუქი-ფაილებს შემდეგი
                      მიზნებისთვის:
                    </Text>

                    <Text style={styles.subsectionTitle}>
                      2.1. აუცილებელი (სავალდებულო) ქუქი-ფაილები
                    </Text>
                    <Text style={styles.sectionText}>
                      ეს ქუქი-ფაილები აუცილებელია ჩვენი სერვისების
                      ფუნქციონირებისთვის და უზრუნველყოფს ისეთი შესაძლებლობების
                      გამოყენებას, როგორიცაა კონტენტის ტექნიკური მიწოდება,
                      კონფიდენციალურობის პრეფერენციების დაყენება, სისტემაში
                      შესვლა, გადახდების განხორციელება ან ფორმების შევსება. ამ
                      ქუქი-ფაილების გარეშე ჩვენი სერვისების მიწოდება
                      შეუძლებელია, შესაბამისად მათი უარყოფა არ არის შესაძლებელი.
                    </Text>

                    <Text style={styles.subsectionTitle}>
                      2.2. შესრულების ქუქი-ფაილები
                    </Text>
                    <Text style={styles.sectionText}>
                      ეს ქუქი-ფაილები აგროვებს ინფორმაციას იმის შესახებ, თუ
                      როგორ იყენებენ მომხმარებლები ჩვენს ვებსაიტს. მაგალითად,
                      ისინი საშუალებას გვაძლევს დავითვალოთ ვიზიტები და გავიგოთ,
                      როგორ მოხვდნენ მომხმარებლები ჩვენს ვებსაიტზე.
                      ანალიტიკური ქუქი-ფაილები გამოიყენება ვებსაიტის მუშაობის
                      გასაუმჯობესებლად, დიზაინის ტესტირებისა და ერთიანი
                      ვიზუალური გამოცდილების უზრუნველსაყოფად. ჩვენ ასევე შეიძლება
                      მივიღოთ ინფორმაცია ჩვენი საინფორმაციო წერილებიდან
                      (ნიუსლეთერებიდან), მათ შორის — გაიხსნა თუ არა წერილი,
                      გადაიგზავნა ან მოხდა თუ არა ბმულზე გადასვლა. აღნიშნული
                      კატეგორია არ მოიცავს ქუქი-ფაილებს, რომლებიც გამოიყენება
                      ქცევაზე დაფუძნებული მიზნობრივი რეკლამებისთვის.
                    </Text>

                    <Text style={styles.subsectionTitle}>
                      2.3. ფუნქციური ქუქი-ფაილები
                    </Text>
                    <Text style={styles.sectionText}>
                      ეს ქუქი-ფაილები საშუალებას აძლევს ვებსაიტს დაიმახსოვროს
                      მომხმარებლის მიერ გაკეთებული არჩევანი, როგორიცაა
                      მომხმარებლის სახელი, ენა ან მდებარეობა, და უზრუნველყოს
                      უფრო პერსონალიზებული ფუნქციები და კონტენტი. თუ ამ
                      ქუქი-ფაილებს არ დაუშვებთ, შესაძლოა წინა ვიზიტებზე
                      გაკეთებული არჩევანი არ შეინახოს.
                    </Text>

                    <Text style={styles.subsectionTitle}>
                      2.4. მიზნობრივი ან სარეკლამო ქუქი-ფაილები
                    </Text>
                    <Text style={styles.sectionText}>
                      ეს ქუქი-ფაილები აგროვებს ინფორმაციას თქვენი ბრაუზინგის
                      ჩვევების შესახებ, რათა შემოგთავაზოთ უფრო შესაბამისი
                      რეკლამა და გავიგოთ თქვენი ინტერესები. ისინი ასევე
                      გამოიყენება რეკლამის ჩვენების სიხშირის შეზღუდვისა და
                      სარეკლამო კამპანიების ეფექტიანობის შეფასებისთვის. თუ არ
                      დაუშვებთ ამ ქუქი-ფაილებს, რეკლამა მაინც გამოჩნდება,
                      თუმცა ის ნაკლებად იქნება მორგებული თქვენს ინტერესებზე.
                    </Text>

                    <Text style={styles.sectionTitle}>
                      3. ქუქი-ფაილებისა და ინტერესებზე დაფუძნებული რეკლამების
                      მართვა
                    </Text>
                    <Text style={styles.subsectionTitle}>ბრაუზერის პარამეტრები</Text>
                    <Text style={styles.sectionText}>
                      თქვენ შეგიძლიათ გამოიყენოთ თქვენი ვებბრაუზერის პარამეტრები
                      ქუქი-ფაილების მისაღებად, უარყოფისთვის ან წასაშლელად. ამისათვის
                      იხილეთ თქვენი ბრაუზერის „Help“, „Tools“ ან „Settings“
                      სექცია. გთხოვთ გაითვალისწინოთ, რომ ქუქი-ფაილების გამორთვამ
                      შესაძლოა შეზღუდოს ვებსაიტის ზოგიერთი ფუნქცია.
                    </Text>

                    <Text style={styles.subsectionTitle}>
                      მობილური იდენტიფიკატორები
                    </Text>
                    <Text style={styles.sectionText}>
                      მობილურ მოწყობილობებზე ოპერაციული სისტემა შესაძლოა მოგცეთ
                      შესაძლებლობა შეზღუდოთ ინტერესებზე დაფუძნებული რეკლამა ან
                      გადატვირთოთ მობილური იდენტიფიკატორი, მაგალითად: iOS — „Allow
                      Apps to Request to Track“ Android — „Opt out of Interest-Based
                      Ads“
                    </Text>

                    <Text style={styles.sectionTitle}>
                      4. ცვლილებები ქუქი-ფაილების პოლიტიკაში
                    </Text>
                    <Text style={styles.sectionText}>
                      ჩვენ შესაძლოა პერიოდულად განვაახლოთ წინამდებარე ქუქი-ფაილების
                      პოლიტიკა. მნიშვნელოვანი ცვლილებების შემთხვევაში მომხმარებელს
                      მიეწოდება შესაბამისი შეტყობინება, მათ შორის ვებსაიტზე
                      განცხადების, ელფოსტის ან სხვა საკომუნიკაციო საშუალების
                      მეშვეობით.
                    </Text>

                    <Text style={styles.sectionTitle}>
                      5. ქუქი-ფაილებზე თანხმობა:
                    </Text>
                    <Text style={styles.sectionText}>
                      Marte.ge - ზე პირველი ვიზიტისას გამოჩნდება ქუქი-ფაილების
                      თანხმობის ბანერი, სადაც შეგიძლიათ: ყველა ქუქი-ფაილის მიღება
                      არაესენციური ქუქი-ფაილების უარყოფა ქუქი-ფაილების
                      პრეფერენციების მორგება თქვენ ნებისმიერ დროს შეგიძლიათ შეცვალოთ
                      თქვენი არჩევანი ვებგვერდის ფუტერში განთავსებული "ქუქი-ფაილების
                      პარამეტრები" ბმულის საშუალებით.
                    </Text>
                  </View>
                </ScrollView>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={() => setShowFullText(false)}
                    style={[styles.button, styles.backToBannerButton]}
                  >
                    <Text style={styles.backToBannerText}>უკან</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Preferences View */}
                <View style={styles.fullTextHeader}>
                  <TouchableOpacity
                    onPress={() => setShowPreferences(false)}
                    style={styles.backButton}
                  >
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.fullTextTitle}>პარამეტრები</Text>
                  <View style={styles.backButton} />
                </View>

                <ScrollView
                  style={styles.fullTextScrollView}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.preferencesContent}>
                    {/* Essential - Always enabled */}
                    <View style={styles.preferenceItem}>
                      <View style={styles.preferenceHeader}>
                        <Text style={styles.preferenceTitle}>
                          აუცილებელი ქუქი-ფაილები
                        </Text>
                        <View style={styles.disabledToggle}>
                          <Ionicons name="lock-closed" size={16} color="#6B7280" />
                        </View>
                      </View>
                      <Text style={styles.preferenceDescription}>
                        ეს ქუქი-ფაილები აუცილებელია სერვისის ფუნქციონირებისთვის
                        და არ შეიძლება გამორთვა.
                      </Text>
                    </View>

                    {/* Performance */}
                    <TouchableOpacity
                      style={styles.preferenceItem}
                      onPress={() =>
                        setPreferences({
                          ...preferences,
                          performance: !preferences.performance,
                        })
                      }
                    >
                      <View style={styles.preferenceHeader}>
                        <Text style={styles.preferenceTitle}>
                          შესრულების ქუქი-ფაილები
                        </Text>
                        <View
                          style={[
                            styles.toggle,
                            preferences.performance && styles.toggleActive,
                          ]}
                        >
                          {preferences.performance && (
                            <View style={styles.toggleThumb} />
                          )}
                        </View>
                      </View>
                      <Text style={styles.preferenceDescription}>
                        ეს ქუქი-ფაილები აგროვებს ინფორმაციას იმის შესახებ, თუ
                        როგორ იყენებენ მომხმარებლები ჩვენს ვებსაიტს.
                      </Text>
                    </TouchableOpacity>

                    {/* Functional */}
                    <TouchableOpacity
                      style={styles.preferenceItem}
                      onPress={() =>
                        setPreferences({
                          ...preferences,
                          functional: !preferences.functional,
                        })
                      }
                    >
                      <View style={styles.preferenceHeader}>
                        <Text style={styles.preferenceTitle}>
                          ფუნქციური ქუქი-ფაილები
                        </Text>
                        <View
                          style={[
                            styles.toggle,
                            preferences.functional && styles.toggleActive,
                          ]}
                        >
                          {preferences.functional && (
                            <View style={styles.toggleThumb} />
                          )}
                        </View>
                      </View>
                      <Text style={styles.preferenceDescription}>
                        ეს ქუქი-ფაილები საშუალებას აძლევს ვებსაიტს დაიმახსოვროს
                        თქვენი არჩევანი და უზრუნველყოს პერსონალიზებული
                        ფუნქციები.
                      </Text>
                    </TouchableOpacity>

                    {/* Advertising */}
                    <TouchableOpacity
                      style={styles.preferenceItem}
                      onPress={() =>
                        setPreferences({
                          ...preferences,
                          advertising: !preferences.advertising,
                        })
                      }
                    >
                      <View style={styles.preferenceHeader}>
                        <Text style={styles.preferenceTitle}>
                          სარეკლამო ქუქი-ფაილები
                        </Text>
                        <View
                          style={[
                            styles.toggle,
                            preferences.advertising && styles.toggleActive,
                          ]}
                        >
                          {preferences.advertising && (
                            <View style={styles.toggleThumb} />
                          )}
                        </View>
                      </View>
                      <Text style={styles.preferenceDescription}>
                        ეს ქუქი-ფაილები აგროვებს ინფორმაციას თქვენი
                        ბრაუზინგის ჩვევების შესახებ, რათა შემოგთავაზოთ უფრო
                        შესაბამისი რეკლამა.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleSavePreferences}
                    style={[styles.button, styles.acceptButton]}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      style={styles.acceptButtonGradient}
                    >
                      <Text style={styles.acceptButtonText}>შენახვა</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

// Export function to check cookie consent
export async function hasCookieConsent(): Promise<boolean> {
  try {
    const consent = await AsyncStorage.getItem(COOKIE_CONSENT_KEY);
    return consent !== null;
  } catch (error) {
    return false;
  }
}

// Export function to get cookie preferences
export async function getCookiePreferences(): Promise<CookiePreferences | null> {
  try {
    const prefs = await AsyncStorage.getItem(COOKIE_PREFERENCES_KEY);
    return prefs ? JSON.parse(prefs) : null;
  } catch (error) {
    return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContent: {
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '90%',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'FiraGO-Bold',
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 200,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    fontFamily: 'FiraGO-Regular',
    lineHeight: 22,
    marginBottom: 16,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  readMoreText: {
    fontSize: 14,
    color: '#6366F1',
    fontFamily: 'FiraGO-Medium',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#F1F5F9',
  },
  rejectButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'FiraGO-Medium',
    fontWeight: '600',
  },
  customizeButton: {
    backgroundColor: '#EEF2FF',
  },
  customizeButtonText: {
    fontSize: 14,
    color: '#6366F1',
    fontFamily: 'FiraGO-Medium',
    fontWeight: '600',
  },
  acceptButton: {
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'FiraGO-Bold',
    fontWeight: '700',
  },
  fullTextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullTextTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'FiraGO-Bold',
    flex: 1,
    textAlign: 'center',
  },
  fullTextScrollView: {
    flex: 1,
    maxHeight: 400,
  },
  fullTextScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  fullTextContent: {
    paddingVertical: 20,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'FiraGO-Bold',
    marginTop: 8,
    marginBottom: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    fontFamily: 'FiraGO-SemiBold',
    marginTop: 12,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#475569',
    fontFamily: 'FiraGO-Regular',
    lineHeight: 22,
    marginBottom: 12,
  },
  backToBannerButton: {
    backgroundColor: '#6366F1',
  },
  backToBannerText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'FiraGO-Medium',
    fontWeight: '600',
  },
  preferencesContent: {
    paddingVertical: 20,
    gap: 16,
  },
  preferenceItem: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  preferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'FiraGO-SemiBold',
    flex: 1,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'FiraGO-Regular',
    lineHeight: 20,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#6366F1',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
  disabledToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
