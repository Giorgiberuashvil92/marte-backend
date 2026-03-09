import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { requestsApi } from '@/services/requestsApi';
import { socketService } from '@/services/socketService';
import { messagesApi, type ChatMessage as ApiChatMessage } from '@/services/messagesApi';
import API_BASE_URL from '@/config/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
};

function normId(v: string | string[] | undefined): string {
  if (v == null) return '';
  return Array.isArray(v) ? (v[0] ?? '') : String(v);
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ requestId: string; partnerId: string }>();
  const requestId = normId(params.requestId);
  const partnerId = normId(params.partnerId);
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('მაღაზია');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestOwnerId, setRequestOwnerId] = useState<string | null>(null);
  const [partnerPhone, setPartnerPhone] = useState<string | null>(null);
  const requestOwnerIdRef = useRef<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // ჩემი მესიჯი = მიმდინარე მომხმარებელი გამომგზავნე; id-ები String-ით ვპოულობთ რომ ტიპის შეუსაბამობა არ იყოს
  const isMessageFromMe = (msg: { sender?: string }) => {
    if (!user?.id) return String(msg.sender).toLowerCase() === 'user';
    const ownerId = requestOwnerIdRef.current ?? requestOwnerId;
    const s = String(msg.sender).toLowerCase();
    const amOwner = s === 'user' && ownerId && String(ownerId) === String(user.id);
    const amPartner = s === 'partner' && partnerId && String(partnerId) === String(user.id);
    return !!amOwner || !!amPartner;
  };

  useEffect(() => {
    if (!requestId || !partnerId || !user?.id) return;
    setupSocket();
    return () => {
      socketService.disconnect();
    };
  }, [requestId, partnerId, user?.id]);

  // ყოველ ჯერზე როცა ეკრანზე დავბრუნდებით (მაგ. ჩატების სიიდან) – ისტორია ხელახლა ჩავტვირთოთ, რომ ახალი მესიჯები ჩანდეს
  useFocusEffect(
    useCallback(() => {
      if (requestId && partnerId && user?.id) loadChat();
    }, [requestId, partnerId, user?.id]),
  );

  const loadChat = async () => {
    if (!requestId || !partnerId) return;
    setLoading(true);
    requestOwnerIdRef.current = null;
    setRequestOwnerId(null);
    setPartnerPhone(null);
    try {
      const [request, offers, history] = await Promise.all([
        requestsApi.getRequestById(requestId),
        requestsApi.getOffers(requestId),
        messagesApi.getChatHistory(requestId, partnerId),
      ]);
      const offer = offers.find((o) => String(o.partnerId) === partnerId) || offers[0];
      if (offer) setPartnerName(offer.providerName || 'მაღაზია');
      if (request?.partName) setRequestTitle(request.partName);
      try {
        const res = await fetch(`${API_BASE_URL}/users/${partnerId}`, {
          headers: { 'x-user-id': user?.id ?? '', 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setPartnerPhone(data?.data?.phone ?? null);
        } else {
          setPartnerPhone(null);
        }
      } catch {
        setPartnerPhone(null);
      }
      const ownerId = request?.userId != null ? String(request.userId) : null;
      if (ownerId) {
        setRequestOwnerId(ownerId);
        requestOwnerIdRef.current = ownerId;
      }
      // [loadChat] ლოგი – ვნახოთ ვინ არის ვინ და როგორ იწერება მესიჯები
      console.log('[loadChat] requestId=', requestId, 'partnerId=', partnerId, 'user.id=', user?.id, 'request.userId=', request?.userId, '→ requestOwnerId=', ownerId);
      console.log('[loadChat] am I owner?', !!ownerId && String(ownerId) === String(user?.id), '| am I partner?', !!partnerId && String(partnerId) === String(user?.id));
      const mapped: Message[] = (history || []).map((msg: ApiChatMessage, i) => {
        const fromMe = isMessageFromMe(msg);
        const role = fromMe ? 'user' : 'assistant';
        if (i < 5) console.log(`[loadChat] msg[${i}] sender=${msg.sender} → fromMe=${fromMe} role=${role} text=${(msg.message || '').slice(0, 20)}...`);
        return {
          id: msg.id || (msg as any)._id,
          role,
          text: msg.message,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        };
      });
      if ((history?.length ?? 0) > 5) console.log('[loadChat] ...', (history?.length ?? 0) - 5, 'more messages');
      setMessages(mapped);
    } catch (e) {
      console.error('Chat load error:', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = () => {
    if (!user?.id || !requestId || !partnerId) return;
    socketService.connect(user.id);
    socketService.joinChat(requestId, user.id, partnerId);

    socketService.onMessage((msg) => {
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            role: isMessageFromMe(msg) ? 'user' : 'assistant',
            text: msg.message,
            timestamp: msg.timestamp,
          },
        ];
      });
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    });

    socketService.onChatHistory((history: ApiChatMessage[]) => {
      const mapped: Message[] = (history || []).map((msg) => ({
        id: msg.id || (msg as any)._id,
        role: isMessageFromMe(msg) ? 'user' : 'assistant',
        text: msg.message,
        timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
      }));
      setMessages(mapped);
    });

    socketService.onTypingStart((data) => {
      const ownerId = requestOwnerIdRef.current ?? requestOwnerId;
      const s = String(data.sender).toLowerCase();
      const otherPartyTyping = (s === 'partner' && ownerId && String(ownerId) === String(user?.id)) || (s === 'user' && partnerId && String(partnerId) === String(user?.id));
      if (otherPartyTyping) setPartnerTyping(true);
    });
    socketService.onTypingStop((data) => {
      const ownerId = requestOwnerIdRef.current ?? requestOwnerId;
      const s = String(data.sender).toLowerCase();
      const otherPartyTyping = (s === 'partner' && ownerId && String(ownerId) === String(user?.id)) || (s === 'user' && partnerId && String(partnerId) === String(user?.id));
      if (otherPartyTyping) setPartnerTyping(false);
    });
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !requestId || !user?.id) return;
    setInputText('');
    socketService.sendMessage(requestId, text);
  };

  const handleCall = () => {
    const phone = partnerPhone?.replace(/\s/g, '') || '';
    if (!phone) {
      Alert.alert('ინფორმაცია', 'ტელეფონის ნომერი ვერ მოიძებნა');
      return;
    }
    const tel = phone.startsWith('+') ? phone : `+995${phone.replace(/^995/, '')}`;
    const url = `tel:${tel}`;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Alert.alert('შეცდომა', 'ტელეფონზე დარეკვა ვერ მოხერხდა');
    }).catch(() => Alert.alert('შეცდომა', 'ტელეფონზე დარეკვა ვერ მოხერხდა'));
  };

  const isSameDay = (a: number, b: number) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  };

  const formatDateLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yday = new Date(Date.now() - 86400000);
    if (isSameDay(ts, today.getTime())) return 'დღეს';
    if (isSameDay(ts, yday.getTime())) return 'გუშინ';
    return d.toLocaleDateString('ka-GE', { day: '2-digit', month: 'short' });
  };

  if (!requestId || !partnerId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>ჩატი ვერ იხსნება</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>უკან</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

        <SafeAreaView edges={['top']} style={styles.topBar}>
          <View style={[styles.topBarContent, { paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }]}>
              <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()} activeOpacity={0.7}>
                <FontAwesome name="arrow-left" size={18} color="#111827" />
              </TouchableOpacity>
              <View style={styles.topBarTitleWrap}>
                <Text style={styles.topBarTitle} numberOfLines={1}>{partnerName}</Text>
                {requestTitle ? <Text style={styles.topBarSubtitle} numberOfLines={1}>{requestTitle}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.topBarButton, styles.topBarCallButton]}
                onPress={handleCall}
                disabled={!partnerPhone}
                activeOpacity={0.7}
              >
                <FontAwesome name="phone" size={18} color={partnerPhone ? '#111827' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>
        </SafeAreaView>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loadingText}>ჩატის ჩატვირთვა...</Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: 24 + insets.bottom },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message, index) => {
                const prev = messages[index - 1];
                const showDate = !prev || !isSameDay(prev.timestamp, message.timestamp);
                const isUser = message.role === 'user';
                const senderLabel = isUser ? (user?.name || 'თქვენ') : partnerName;
                return (
                  <View key={message.id} style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
                    {showDate && (
                      <View style={styles.dateRow}>
                        <View style={styles.dateLine} />
                        <Text style={styles.dateText}>{formatDateLabel(message.timestamp)}</Text>
                        <View style={styles.dateLine} />
                      </View>
                    )}
                    <View style={styles.bubbleWrap}>
                      <Text style={[styles.senderLabel, isUser ? styles.senderLabelUser : styles.senderLabelPartner]} numberOfLines={1}>
                        {senderLabel}
                      </Text>
                      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.text}</Text>
                        <Text style={[styles.bubbleTime, isUser && styles.userBubbleTime]}>
                          {new Date(message.timestamp).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {partnerTyping && (
                <View style={[styles.messageRow, styles.assistantRow]}>
                  <View style={styles.bubbleWrap}>
                    <Text style={[styles.senderLabel, styles.senderLabelPartner]}>{partnerName}</Text>
                    <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                      <Text style={styles.typingText}>აკრეფს...</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
              <View
                style={[
                  styles.inputRow,
                  {
                    paddingBottom: 10 + insets.bottom,
                    paddingLeft: 12 + insets.left,
                    paddingRight: 12 + insets.right,
                  },
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={(t) => {
                    setInputText(t);
                    if (t.length > 0) socketService.startTyping(requestId, 'user');
                    else socketService.stopTyping(requestId, 'user');
                  }}
                  placeholder="შეტყობინება..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim()}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="send" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCallButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topBarTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  userRow: { alignItems: 'flex-end' },
  assistantRow: { alignItems: 'flex-start' },
  bubbleWrap: {
    maxWidth: '85%',
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  senderLabelUser: {
    color: '#4F46E5',
    textAlign: 'right',
  },
  senderLabelPartner: {
    color: '#6B7280',
    textAlign: 'left',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bubbleText: {
    fontSize: 15,
    color: '#111827',
  },
  userBubbleText: { color: '#FFFFFF' },
  bubbleTime: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  userBubbleTime: { color: 'rgba(255,255,255,0.85)' },
  typingBubble: { paddingVertical: 8 },
  typingText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 40,
  },
  backBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});
