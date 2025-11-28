# 메시징 시스템 설치 가이드

이 가이드는 REBIL 플랫폼에서 호스트와 렌터 간의 메시징 기능을 설정하는 방법을 설명합니다.

## 🚀 구현된 기능

### ✅ 완료된 기능
1. **데이터베이스 RPC 함수** - 메시지 CRUD 및 보안 검증
2. **TypeScript 타입 정의** - 완전한 타입 안전성
3. **백엔드 API 엔드포인트** - RESTful API
4. **React 커스텀 훅** - 상태 관리 및 캐싱
5. **프론트엔드 컴포넌트** - 실시간 메시지 UI
6. **예약 상세 페이지 통합** - 인라인 메시징
7. **오프라인 예약 제한** - 자동 차단 로직

## 📋 설정 단계

### 1. 데이터베이스 함수 생성

Supabase SQL Editor에서 다음 파일을 실행하세요:

```sql
-- supabase/functions/messaging.sql 파일의 내용을 복사하여 실행
-- 이 파일에는 다음 함수들이 포함되어 있습니다:
-- - get_booking_messages()
-- - send_booking_message()
-- - mark_messages_read()
-- - get_unread_message_count()
-- - get_user_conversations()
```

### 2. 필요한 인덱스 생성 확인

다음 인덱스들이 생성되었는지 확인하세요:

```sql
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
```

### 3. 권한 설정 확인

RPC 함수들이 인증된 사용자에게 실행 권한이 있는지 확인하세요:

```sql
GRANT EXECUTE ON FUNCTION get_booking_messages(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION send_booking_message(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID, INTEGER, INTEGER) TO authenticated;
```

## 🎯 사용법

### 메시지 페이지 접근
독립적인 메시지 페이지:
```
/messages
```

### 예약 상세 페이지에서 메시징
예약이 확정된 상태에서 호스트와 렌터 간에 직접 메시징 가능

### 컴포넌트 사용 예제

```tsx
import { MessageThread, ConversationList, MessageNotification } from '@/components/messages';
import { useMessages, useConversations } from '@/hooks';

// 메시지 스레드
<MessageThread 
  booking_id={booking.id}
  current_user_id={user.id}
  other_user_id={otherUser.id}
  other_user_name={otherUser.name}
/>

// 대화 목록
const { conversations, unreadCount } = useConversations();
<ConversationList 
  conversations={conversations}
  onConversationSelect={setSelected}
/>

// 알림 배지
<MessageNotification 
  unreadCount={unreadCount}
  onClick={() => router.push('/messages')}
/>
```

## 🔒 보안 기능

### 1. 오프라인 예약 제한
- 오프라인 예약(`special_instructions.is_offline_booking: true`)은 메시징이 차단됩니다
- UI에서 자동으로 메시지 버튼이 비활성화됩니다

### 2. 권한 검증
- 예약 참여자(호스트/렌터)만 해당 대화에 접근 가능
- 메시지 읽음/보내기 권한 자동 검증
- SQL 인젝션 및 권한 상승 공격 방지

### 3. 입력 검증
- 메시지 길이 제한 (2000자)
- 빈 메시지 차단
- XSS 방지를 위한 텍스트 이스케이핑

## 🚦 상태 관리

### React Query 캐싱
- 메시지: 10초 stale time, 30초 refetch interval
- 대화 목록: 30초 stale time, 60초 refetch interval
- 읽지 않은 메시지 수: 10초 stale time, 30초 refetch interval

### 실시간 업데이트
- 메시지 전송 시 자동 캐시 무효화
- 낙관적 업데이트로 빠른 UI 반응
- 읽음 상태 자동 동기화

## 📱 UI/UX 기능

### 1. 메시지 스레드
- 날짜별 그룹화
- 읽음/전송 상태 표시
- 자동 스크롤
- 문자 수 제한 표시

### 2. 대화 목록
- 마지막 메시지 미리보기
- 읽지 않은 메시지 배지
- 예약 상태 표시
- 차량 정보 표시

### 3. 알림 시스템
- 실시간 읽지 않은 메시지 수
- 펄스 애니메이션
- 네비게이션 통합

## 🐛 문제 해결

### 1. 메시지가 표시되지 않는 경우
- 예약이 CONFIRMED 상태인지 확인
- 오프라인 예약이 아닌지 확인
- RPC 함수가 올바르게 생성되었는지 확인

### 2. 권한 오류가 발생하는 경우
- 사용자가 해당 예약의 참여자인지 확인
- Supabase 인증 상태 확인
- RPC 함수 권한 설정 확인

### 3. 성능 이슈가 발생하는 경우
- 메시지 페이지네이션 활용
- React Query 캐시 설정 조정
- 데이터베이스 인덱스 확인

## 🔄 향후 개선사항

1. **실시간 메시징** - WebSocket 또는 Server-Sent Events
2. **푸시 알림** - 브라우저 알림 API
3. **파일 첨부** - 이미지/문서 공유
4. **메시지 검색** - 전문 검색 기능
5. **메시지 상태** - 전달됨/읽음 확인

## 📚 API 참조

### GET /api/messages
메시지 목록 조회
- Query: `booking_id`, `limit`, `offset`

### POST /api/messages  
메시지 전송
- Body: `booking_id`, `receiver_id`, `message`

### PUT /api/messages/read
메시지 읽음 처리
- Body: `booking_id`, `message_ids?`

### GET /api/messages/conversations
대화 목록 조회
- Query: `limit`, `offset`

### GET /api/messages/unread-count
읽지 않은 메시지 수 조회

---

**주의사항**: 모든 API 엔드포인트는 인증이 필요하며, 예약 참여자만 접근할 수 있습니다.